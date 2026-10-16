import assert from 'node:assert/strict';
import { Pool } from '@neondatabase/serverless';
import {
  CoreDatabase,
  DataError,
  SessionStore,
  type CoreTransaction,
  type VerifiedPrincipal,
} from '../../src/db/connection';
import type { Commands, RequestEvidence } from '../../src/db/types';
import { issueSyntheticSession, syntheticDigest, syntheticEvidence } from './fixtures';
import { loadTarget } from './target';

const { secrets } = loadTarget();
if (!secrets.CORE_AUTH_DATABASE_URL || !secrets.CORE_APP_DATABASE_URL)
  throw new Error('Run guarded core migration first');
const auth = new SessionStore(secrets.CORE_AUTH_DATABASE_URL);
const db = new CoreDatabase(secrets.CORE_APP_DATABASE_URL);
const owner = new Pool({ connectionString: secrets.MIGRATION_DATABASE_URL, max: 1 });
let checks = 0;
const pass = (label: string) => console.log(`PASS ${++checks} ${label}`);
const read = <T>(actor: VerifiedPrincipal, work: (tx: CoreTransaction) => Promise<T>) =>
  db.withPrincipal(actor, work);
const command = <K extends keyof Commands>(
  actor: VerifiedPrincipal,
  op: K,
  houseId: string | null,
  resourceId: string | null,
  input: Commands[K],
  evidence: RequestEvidence = syntheticEvidence(),
) => db.withPrincipal(actor, (tx) => tx.command(op, houseId, resourceId, input, evidence));
const denied = (work: () => Promise<unknown>, code = 'not_found') =>
  assert.rejects(work, (error: unknown) => error instanceof DataError && error.code === code);
const exactKeys = (value: object, expected: string[]) =>
  assert.deepEqual(Object.keys(value).sort(), expected.sort());
const noPrivateFields = (value: unknown) => {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) return value.forEach(noPrivateFields);
  for (const [key, child] of Object.entries(value)) {
    assert.doesNotMatch(
      key.toLowerCase(),
      /ciphertext|digest|identifier|accountnumber|account_number|provider|slip|token|secret|rawresponse/,
      `private field leaked: ${key}`,
    );
    noPrivateFields(child);
  }
};
const localDate = (date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
const dateAfter = (date: string, days: number) => {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

async function main() {
  try {
    const [a, b, c, d] = await Promise.all(
      ['SW0063 owner', 'SW0063 member', 'SW0063 other-house', 'SW0063 removed-member'].map(
        (label) => issueSyntheticSession(auth, label),
      ),
    );
    const houseResult = await command(a.claims, 'house.create', null, null, {
      name: 'SW0063 read parity',
      timezone: 'Asia/Bangkok',
    });
    const otherHouseResult = await command(c.claims, 'house.create', null, null, {
      name: 'SW0063 other house',
      timezone: 'UTC',
    });
    const houseId = houseResult.resourceId;
    const otherHouseId = otherHouseResult.resourceId;
    const invite = await command(a.claims, 'invite.create', houseId, null, {
      tokenDigest: syntheticDigest(),
      replayCiphertext: `synthetic-${syntheticDigest()}`,
      expiresInSeconds: 604800,
    });
    const tokenDigest = (await read(a.claims, (tx) => tx.invitation(houseId, invite.resourceId)))
      .id;
    // invite.accept uses the raw digest only as a command input; it never leaves this script.
    const invited = await owner.query<{ token_digest: string }>(
      'select token_digest from core.house_invitations where id=$1',
      [invite.resourceId],
    );
    const joined = await command(b.claims, 'invite.accept', null, null, {
      tokenDigest: invited.rows[0]?.token_digest ?? tokenDigest,
    });
    assert(joined.data);
    const memberB = joined.resourceId;
    const inviteD = await command(a.claims, 'invite.create', houseId, null, {
      tokenDigest: syntheticDigest(),
      replayCiphertext: `synthetic-${syntheticDigest()}`,
      expiresInSeconds: 604800,
    });
    const inviteDRow = await owner.query<{ token_digest: string }>(
      'select token_digest from core.house_invitations where id=$1',
      [inviteD.resourceId],
    );
    const joinedD = await command(d.claims, 'invite.accept', null, null, {
      tokenDigest: inviteDRow.rows[0]?.token_digest ?? '',
    });
    const memberD = joinedD.resourceId;
    const memberA = (await read(a.claims, (tx) => tx.ownMembership(houseId))).id;

    const accountFor = async (actor: VerifiedPrincipal, label: string) => {
      const input: Commands['account.create'] = {
        bankCode: 'SYNTHETIC',
        identifierKind: 'bank_account',
        identifierCiphertext: `synthetic-ciphertext-${syntheticDigest()}`,
        identifierDigest: syntheticDigest(),
        keyVersion: 1,
        label,
        maskedAccount: '••••0063',
        isDefault: true,
      };
      return command(actor, 'account.create', null, null, input);
    };
    const accountA = await accountFor(a.claims, 'SW0063 A');
    const accountB = await accountFor(b.claims, 'SW0063 B');
    const today = localDate();
    const dueDate = dateAfter(today, 7);

    const createBill = async (args: {
      title: string;
      totalSatang: number;
      recipientMembershipId: string;
      recipientAccountId: string;
      participants: Commands['bill.create']['participants'];
      publish: boolean;
    }) => {
      const draft = await command(a.claims, 'bill.create', houseId, null, {
        title: args.title,
        totalSatang: args.totalSatang,
        currency: 'THB',
        recipientMembershipId: args.recipientMembershipId,
        participants: args.participants,
        dueDate,
      });
      if (args.publish)
        await command(a.claims, 'bill.publish', houseId, draft.resourceId, {
          recipientAccountId: args.recipientAccountId,
          recipientAccountVersion: 1,
          expectedVersion: 1,
        });
      return draft.resourceId;
    };
    const publishedBills: string[] = [];
    for (let i = 0; i < 21; i++)
      publishedBills.push(
        await createBill({
          title: `SW0063 settled ${i}`,
          totalSatang: 100,
          recipientMembershipId: memberB,
          recipientAccountId: accountB.resourceId,
          participants: [{ membershipId: memberB, basisPoints: 10000 }],
          publish: true,
        }),
      );

    const largeBills: string[] = [];
    for (let i = 0; i < 3; i++)
      largeBills.push(
        await createBill({
          title: `SW0063 exact total ${i}`,
          totalSatang: 900000000000,
          recipientMembershipId: memberB,
          recipientAccountId: accountB.resourceId,
          participants: [
            { membershipId: memberA, basisPoints: 8000 },
            { membershipId: memberB, basisPoints: 2000 },
          ],
          publish: true,
        }),
      );
    await createBill({
      title: 'SW0063 owed to owner',
      totalSatang: 10000,
      recipientMembershipId: memberA,
      recipientAccountId: accountA.resourceId,
      participants: [
        { membershipId: memberA, basisPoints: 3000 },
        { membershipId: memberB, basisPoints: 7000 },
      ],
      publish: true,
    });
    const draftBill = await createBill({
      title: 'SW0063 private draft',
      totalSatang: 100,
      recipientMembershipId: memberB,
      recipientAccountId: accountB.resourceId,
      participants: [{ membershipId: memberB, basisPoints: 10000 }],
      publish: false,
    });

    const selector = await read(a.claims, (tx) => tx.accountSelector(houseId, draftBill, memberB));
    assert.equal(selector.length, 1);
    const selectedAccount = selector[0];
    assert(selectedAccount);
    exactKeys(selectedAccount, [
      'id',
      'version',
      'bankCode',
      'label',
      'maskedAccount',
      'isDefault',
    ]);
    assert.equal(selector[0]?.id, accountB.resourceId);
    assert.equal(selector[0]?.maskedAccount, '••••0063');
    noPrivateFields(selector);
    await denied(
      () => read(a.claims, (tx) => tx.accountSelector(houseId, draftBill, memberA)),
      'validation_error',
    );

    const billPage1 = await read(a.claims, (tx) => tx.bills(houseId, { limit: 20 }));
    assert.equal(billPage1.items.length, 20);
    assert(billPage1.nextCursor);
    const billCursor = billPage1.nextCursor;
    assert(billCursor);
    const billPage2 = await read(a.claims, (tx) =>
      tx.bills(houseId, { limit: 20, cursor: billCursor }),
    );
    assert.equal(billPage1.items.length + billPage2.items.length, 26);
    assert.equal(billPage2.nextCursor, null);
    assert.equal(new Set([...billPage1.items, ...billPage2.items].map((x) => x.id)).size, 26);
    const lastBill = billPage1.items.at(-1);
    assert(lastBill);
    assert.equal(billPage1.items[0]?.createdAt <= lastBill.createdAt, true);
    assert(!billPage1.items.some((item) => 'identifierCiphertext' in item));
    assert(!billPage1.items.some((item) => 'recipientAccountEncrypted' in item));
    assert(billPage1.items.every((item) => Number.isSafeInteger(item.totalSatang)));
    noPrivateFields([...billPage1.items, ...billPage2.items]);
    const memberBills = await read(b.claims, (tx) => tx.bills(houseId));
    assert.equal(memberBills.items.length, 20);
    assert(memberBills.nextCursor);
    assert(!memberBills.items.some((item) => item.status === 'draft'));
    await denied(() => read(c.claims, (tx) => tx.bills(houseId)));
    for (const options of [{ limit: 0 }, { limit: 101 }, { cursor: 'invalid' }])
      await denied(() => read(a.claims, (tx) => tx.bills(houseId, options)), 'validation_error');
    pass(
      'bills: stable multi-page cursor, default/max validation, private draft and masked projection',
    );

    const recipientBillId = publishedBills[0];
    assert(recipientBillId);
    const owingBillId = largeBills[0];
    assert(owingBillId);
    const recipientDestination = await read(b.claims, (tx) =>
      tx.privateDestination(houseId, recipientBillId),
    );
    assert(recipientDestination);
    exactKeys(recipientDestination, [
      'bankCode',
      'identifierKind',
      'identifierCiphertext',
      'keyVersion',
      'recipientName',
      'ownerUserId',
      'identifierDigest',
    ]);
    assert.equal(recipientDestination.ownerUserId, b.claims.userId);
    const owingDestination = await read(a.claims, (tx) =>
      tx.privateDestination(houseId, owingBillId),
    );
    assert(owingDestination);
    assert.equal(owingDestination.ownerUserId, b.claims.userId);
    await denied(
      () => read(d.claims, (tx) => tx.privateDestination(houseId, owingBillId)),
      'forbidden',
    );
    await denied(
      () => read(c.claims, (tx) => tx.privateDestination(houseId, owingBillId)),
      'not_found',
    );
    const changedAccountDigest = syntheticDigest();
    await command(b.claims, 'account.update', null, accountB.resourceId, {
      expectedVersion: 1,
      identifierCiphertext: `synthetic-mutated-${syntheticDigest()}`,
      identifierDigest: changedAccountDigest,
    });
    assert.deepEqual(
      await read(a.claims, (tx) => tx.privateDestination(houseId, owingBillId)),
      owingDestination,
    );
    const publicBillJson = JSON.stringify([...billPage1.items, ...billPage2.items]);
    assert(!publicBillJson.includes('ownerUserId'));
    assert(!publicBillJson.includes('identifierDigest'));
    pass(
      'private destination: recipient/owing-payer access, frozen snapshot AAD and hidden metadata',
    );

    const paymentBillId = largeBills[0];
    assert(paymentBillId);
    const paymentIds: string[] = [];
    for (let i = 0; i < 21; i++) {
      const input: Commands['payment.reserve'] = {
        method: 'cash',
        amountSatang: 1,
        expectedVersion: 2,
      };
      paymentIds.push(
        (
          await command(
            a.claims,
            'payment.reserve',
            houseId,
            paymentBillId,
            input,
            syntheticEvidence(),
          )
        ).resourceId,
      );
    }
    const paymentPage1 = await read(a.claims, (tx) =>
      tx.payments(houseId, paymentBillId, { limit: 20 }),
    );
    assert.equal(paymentPage1.items.length, 20);
    assert(paymentPage1.nextCursor);
    const paymentCursor = paymentPage1.nextCursor;
    assert(paymentCursor);
    const paymentPage2 = await read(a.claims, (tx) =>
      tx.payments(houseId, paymentBillId, { limit: 20, cursor: paymentCursor }),
    );
    assert.equal(paymentPage2.items.length, 1);
    assert.equal(paymentPage2.nextCursor, null);
    assert.deepEqual(
      new Set([...paymentPage1.items, ...paymentPage2.items].map((item) => item.id)),
      new Set(paymentIds),
    );
    assert(paymentPage1.items.every((item) => item.method === 'cash' && item.amountSatang === 1));
    assert(paymentPage1.items.every((item) => item.status === 'awaiting_confirmation'));
    noPrivateFields([...paymentPage1.items, ...paymentPage2.items]);
    assert.deepEqual(await read(d.claims, (tx) => tx.payments(houseId, paymentBillId)), {
      items: [],
      nextCursor: null,
    });
    await denied(() => read(c.claims, (tx) => tx.payments(houseId, paymentBillId)));
    for (const options of [{ limit: 0 }, { limit: 101 }, { cursor: 'invalid' }])
      await denied(
        () => read(a.claims, (tx) => tx.payments(houseId, paymentBillId, options)),
        'validation_error',
      );
    pass(
      'payments: stable pagination, payer and cash-creator scope, summaries exclude private fields',
    );

    const choreIds: string[] = [];
    for (let i = 0; i < 21; i++)
      choreIds.push(
        (
          await command(a.claims, 'chore.create', houseId, null, {
            title: `SW0063 chore ${i}`,
            localDate: today,
            assigneeMembershipId: i % 2 === 0 ? memberA : memberB,
            emoji: '🧹',
          })
        ).resourceId,
      );
    const chorePage1 = await read(a.claims, (tx) =>
      tx.chores(houseId, { fromDate: today, toDate: today, limit: 20 }),
    );
    assert.equal(chorePage1.items.length, 20);
    assert(chorePage1.nextCursor);
    const choreCursor = chorePage1.nextCursor;
    assert(choreCursor);
    const chorePage2 = await read(a.claims, (tx) =>
      tx.chores(houseId, {
        fromDate: today,
        toDate: today,
        limit: 20,
        cursor: choreCursor,
      }),
    );
    assert.equal(chorePage2.items.length, 1);
    assert.equal(chorePage2.nextCursor, null);
    assert.deepEqual(
      new Set([...chorePage1.items, ...chorePage2.items].map((item) => item.id)),
      new Set(choreIds),
    );
    assert(
      (await read(a.claims, (tx) => tx.chores(houseId, { fromDate: today, limit: 100 }))).items
        .length >= 21,
    );
    for (const options of [
      { fromDate: '2026-02-30' },
      { fromDate: dateAfter(today, 2), toDate: today },
      { cursor: 'invalid' },
      { limit: 101 },
    ])
      await denied(() => read(a.claims, (tx) => tx.chores(houseId, options)), 'validation_error');
    assert(chorePage1.items.every((item) => item.localDate === today));
    noPrivateFields([...chorePage1.items, ...chorePage2.items]);
    const choreToComplete = choreIds[1];
    assert(choreToComplete);
    const listedChores = await read(a.claims, (tx) =>
      tx.chores(houseId, { fromDate: today, toDate: today, limit: 100 }),
    );
    const assignedPending = listedChores.items.find((item) => item.id === choreToComplete);
    assert(assignedPending);
    assert(!('scheduleId' in assignedPending));
    assert(!('completedAt' in assignedPending));
    assert(!('completedByMembershipId' in assignedPending));
    await command(
      b.claims,
      'chore.complete',
      houseId,
      choreToComplete,
      { expectedVersion: 1 },
      syntheticEvidence(),
    );
    const completedChore = (
      await read(a.claims, (tx) =>
        tx.chores(houseId, { fromDate: today, toDate: today, limit: 100 }),
      )
    ).items.find((item) => item.id === choreToComplete);
    assert(completedChore);
    assert(completedChore.completedAt);
    assert.equal(completedChore.completedByMembershipId, memberB);
    await command(b.claims, 'chore.reopen', houseId, choreToComplete, { expectedVersion: 2 });
    const reopenedChore = (
      await read(a.claims, (tx) =>
        tx.chores(houseId, { fromDate: today, toDate: today, limit: 100 }),
      )
    ).items.find((item) => item.id === choreToComplete);
    assert(reopenedChore);
    assert.equal(reopenedChore.status, 'pending');
    assert(!('completedAt' in reopenedChore));
    assert(!('completedByMembershipId' in reopenedChore));
    pass(
      'chores: local-date filters, same-date keyset pagination, invalid dates/ranges and safe projection',
    );

    const activityPage1 = await read(a.claims, (tx) => tx.activity(houseId, { limit: 20 }));
    assert.equal(activityPage1.items.length, 20);
    assert(activityPage1.nextCursor);
    const activityCursor1 = activityPage1.nextCursor;
    assert(activityCursor1);
    const activityPage2 = await read(a.claims, (tx) =>
      tx.activity(houseId, { limit: 20, cursor: activityCursor1 }),
    );
    assert.equal(activityPage2.items.length, 20);
    assert(activityPage2.nextCursor);
    const activityCursor2 = activityPage2.nextCursor;
    assert(activityCursor2);
    const activityPage3 = await read(a.claims, (tx) =>
      tx.activity(houseId, { limit: 20, cursor: activityCursor2 }),
    );
    const allActivities = [...activityPage1.items, ...activityPage2.items, ...activityPage3.items];
    assert(allActivities.length > 40);
    assert.equal(new Set(allActivities.map((item) => item.id)).size, allActivities.length);
    assert(allActivities.every((item) => item.houseId === houseId));
    assert(
      allActivities.every((item) => typeof item.summary === 'string' && item.summary.length > 0),
    );
    noPrivateFields(allActivities);
    assert.deepEqual(await read(c.claims, (tx) => tx.activity(otherHouseId)), {
      items: [],
      nextCursor: null,
    });
    await denied(() => read(b.claims, (tx) => tx.activity(otherHouseId)));
    await denied(() => read(c.claims, (tx) => tx.activity(houseId)));
    await denied(
      () => read(a.claims, (tx) => tx.activity(houseId, { cursor: 'invalid' })),
      'validation_error',
    );
    pass('activity: chronological keyset pages, house scope and no payment/account/slip details');

    const dashboard = await read(a.claims, (tx) => tx.dashboard(houseId));
    assert.equal(dashboard.outstandingSatang, '2160000000000');
    assert.equal(dashboard.owedToMeSatang, '7000');
    assert.equal(dashboard.pendingSatang, '21');
    assert.equal(dashboard.cashAwaitingDecisionCount, 21);
    assert(dashboard.asOf);
    assert(dashboard.todayChores.length <= 20);
    assert(dashboard.todayChores.every((chore) => chore.localDate === today));
    assert(dashboard.todayChores.every((chore) => !('scheduleId' in chore)));
    assert(dashboard.todayChores.every((chore) => !('completedAt' in chore)));
    assert(dashboard.todayChores.every((chore) => !('completedByMembershipId' in chore)));
    assert.equal(dashboard.pendingPayments.length, 20);
    assert(dashboard.pendingPayments.every((payment) => payment.method === 'cash'));
    noPrivateFields(dashboard);
    await denied(() => read(c.claims, (tx) => tx.dashboard(houseId)));
    // This house is empty and belongs only to c; b is a member of houseId, not otherHouseId.
    // Explicit authorization must fail even if every dashboard child relation is empty.
    await denied(() => read(b.claims, (tx) => tx.dashboard(otherHouseId)));
    await denied(() => read(a.claims, (tx) => tx.dashboard(crypto.randomUUID())));
    pass(
      'dashboard: exact totals, house-local date and unauthorized empty/nonexistent-house denial',
    );

    // Move one synthetic parent and its child to the access-expiry boundary. The owner
    // connection is used only for these disposable fixture updates, never for reads.
    const expiredBill = publishedBills[0];
    assert(expiredBill);
    await owner.query(
      `update core.bills set created_at=statement_timestamp()-interval '364 days',
       expires_at=statement_timestamp()-interval '2 hours',
       retention_deadline_at=statement_timestamp()+interval '22 hours'
     where house_id=$1 and id=$2`,
      [houseId, expiredBill],
    );
    await owner.query(
      `update core.bill_shares set created_at=(select created_at from core.bills where id=$2),
       expires_at=(select expires_at from core.bills where id=$2),
       retention_deadline_at=(select retention_deadline_at from core.bills where id=$2)
     where house_id=$1 and bill_id=$2`,
      [houseId, expiredBill],
    );
    const afterExpiry = await read(a.claims, (tx) => tx.bills(houseId, { limit: 100 }));
    assert(!afterExpiry.items.some((item) => item.id === expiredBill));
    await denied(
      () => read(b.claims, (tx) => tx.privateDestination(houseId, expiredBill)),
      'expired',
    );
    assert(
      !(await read(a.claims, (tx) => tx.activity(houseId, { limit: 100 }))).items.some(
        (item) => item.summary === 'SW0063 settled 0',
      ),
    );

    const expiredChore = choreIds[0];
    assert(expiredChore);
    await owner.query(
      `update core.chore_occurrences set created_at=statement_timestamp()-interval '364 days',
       expires_at=statement_timestamp()-interval '2 hours',
       retention_deadline_at=statement_timestamp()+interval '22 hours'
     where house_id=$1 and id=$2`,
      [houseId, expiredChore],
    );
    assert(
      !(await read(a.claims, (tx) => tx.chores(houseId, { limit: 100 }))).items.some(
        (x) => x.id === expiredChore,
      ),
    );
    pass('expired parents and their activity disappear from live projections');

    const membership = await read(a.claims, (tx) => tx.targetMembership(houseId, memberD));
    await command(a.claims, 'member.remove', houseId, memberD, {
      expectedVersion: membership.version,
    });
    await denied(() => read(d.claims, (tx) => tx.bills(houseId)));
    await denied(() => read(d.claims, (tx) => tx.chores(houseId)));
    await denied(() => read(d.claims, (tx) => tx.activity(houseId)));
    await denied(() => read(d.claims, (tx) => tx.dashboard(houseId)));
    await auth.execute('revoke', { sessionId: a.claims.sessionId });
    await denied(() => read(a.claims, (tx) => tx.dashboard(houseId)), 'unauthenticated');
    pass('removed membership and revoked session lose all projections immediately');

    console.log(
      `SW-0063 read parity restricted-role suite: ${checks} groups passed; synthetic only`,
    );
  } finally {
    await Promise.all([auth.close(), db.close(), owner.end()]);
  }
}
void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
