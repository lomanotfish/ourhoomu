import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Share, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ApiHttpError } from '@/api/errors';
import type { House, InvitationIssued, Member, OwnAccount } from '@/repositories/contracts';
import { selectHouse } from '@/repositories/house-selection';
import { useAppRuntime } from '@/runtime/api-mode';
import { createOperationGuard } from '@/runtime/operation-guard';
import { Button, Card, Field, Label, Page, Pill, Small, Tap, Title } from '@/components/ui';
import { colors } from '@/theme/tokens';

const HOUSEHOLD_TIMEZONE = 'Asia/Bangkok';
const INVITATION_LIFETIME_SECONDS = 7 * 24 * 60 * 60;

export default function ApiModeScreen() {
  const { runtime, authGeneration } = useAppRuntime();
  const router = useRouter();
  const [profileName, setProfileName] = useState('');
  const [houses, setHouses] = useState<House[]>([]);
  const [status, setStatus] = useState<'loading' | 'signedOut' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [houseName, setHouseName] = useState('');
  const [invite, setInvite] = useState('');
  const [persistedHouseId, setPersistedHouseId] = useState<string | null>(null);
  const [activeHouse, setActiveHouse] = useState<House | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [activeInvitation, setActiveInvitation] = useState<InvitationIssued | null>(null);
  const [accounts, setAccounts] = useState<OwnAccount[]>([]);
  const [accountEditing, setAccountEditing] = useState<OwnAccount | null>(null);
  const [accountLabel, setAccountLabel] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountDefault, setAccountDefault] = useState(false);
  const loadGeneration = useRef(0);
  const dataGeneration = useRef(0);
  const authGenerationRef = useRef(authGeneration);
  authGenerationRef.current = authGeneration;
  const activeHouseIdRef = useRef<string | null>(activeHouse?.id ?? null);
  activeHouseIdRef.current = activeHouse?.id ?? null;

  useEffect(() => {
    ++loadGeneration.current;
    ++dataGeneration.current;
    setBusy(false);
    setError('');
    setStatus('loading');
    setActiveInvitation(null);
    setMembers([]);
    setAccounts([]);
    setActiveHouse(null);
    setProfileName('');
    setHouses([]);
    setPersistedHouseId(null);
  }, [authGeneration, runtime]);

  const clearAuthenticatedData = () => {
    ++loadGeneration.current;
    ++dataGeneration.current;
    setProfileName('');
    setHouses([]);
    setPersistedHouseId(null);
    setActiveHouse(null);
    setBusy(false);
    setMembers([]);
    setAccounts([]);
    setActiveInvitation(null);
    setAccountEditing(null);
    setAccountLabel('');
    setBankCode('');
    setAccountNumber('');
    setAccountDefault(false);
  };

  const clearHouseData = (houseId: string) => {
    if (persistedHouseId === houseId) setPersistedHouseId(null);
    if (activeHouseIdRef.current === houseId) {
      ++dataGeneration.current;
      setBusy(false);
      setActiveHouse(null);
      setMembers([]);
      setActiveInvitation(null);
    }
  };

  const load = useCallback(async () => {
    if (!runtime) return;
    const generation = ++loadGeneration.current;
    const authAtStart = authGeneration;
    const current = createOperationGuard({
      generation,
      liveGeneration: () => loadGeneration.current,
      authGeneration: authAtStart,
      liveAuthGeneration: () => authGenerationRef.current,
    }).current;
    setStatus('loading');
    setError('');
    setProfileName('');
    setHouses([]);
    setActiveHouse(null);
    setMembers([]);
    setAccounts([]);
    setActiveInvitation(null);
    try {
      const me = await runtime.session.bootstrap();
      if (!current()) return;
      setProfileName(me.displayName);
      const all = await loadAllHouses(runtime.houses);
      if (!current()) return;
      setHouses(all);
      const decision = selectHouse({ houses: all, persistedHouseId });
      if (decision.status === 'enter') {
        setPersistedHouseId(decision.house.id);
        setActiveHouse(decision.house);
      } else if (decision.status === 'recovery_required') {
        setError('บ้านที่เลือกไว้เข้าไม่ได้แล้ว กรุณาเลือกบ้านที่ยังได้รับอนุญาต');
      }
      setStatus('ready');
    } catch (cause) {
      if (!current()) return;
      if (cause instanceof ApiHttpError && cause.status === 401) {
        clearAuthenticatedData();
        setBusy(false);
      }
      setStatus(cause instanceof ApiHttpError && cause.status === 401 ? 'signedOut' : 'error');
      setError(messageFor(cause));
    }
  }, [runtime, persistedHouseId, authGeneration]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadHouseDetail = useCallback(
    async (house: House) => {
      if (!runtime) return;
      const generation = ++dataGeneration.current;
      const authAtStart = authGeneration;
      const current = createOperationGuard({
        generation,
        liveGeneration: () => dataGeneration.current,
        authGeneration: authAtStart,
        liveAuthGeneration: () => authGenerationRef.current,
        targetHouseId: house.id,
        liveTargetHouseId: () => activeHouseIdRef.current,
      }).current;
      setError('');
      setBusy(true);
      try {
        const [detail, page] = await Promise.all([
          runtime.houses.detail(house.id),
          runtime.houses.members(house.id, { limit: 100 }),
        ]);
        if (!current()) return;
        const allMembers = [...page.data];
        let nextCursor = page.nextCursor;
        while (nextCursor) {
          const next = await runtime.houses.members(house.id, { cursor: nextCursor, limit: 100 });
          if (!current()) return;
          allMembers.push(...next.data);
          nextCursor = next.nextCursor;
        }
        if (!current()) return;
        setActiveHouse(detail);
        setMembers(allMembers);
        setPersistedHouseId(detail.id);
      } catch (cause) {
        if (!current()) return;
        if (cause instanceof ApiHttpError && cause.status === 401) {
          clearAuthenticatedData();
          setStatus('signedOut');
        } else if (cause instanceof ApiHttpError && [403, 404, 410].includes(cause.status)) {
          clearHouseData(house.id);
        }
        setActiveHouse(null);
        setMembers([]);
        setError(messageFor(cause));
      } finally {
        if (current()) setBusy(false);
      }
    },
    [runtime, authGeneration, persistedHouseId, activeHouse],
  );

  const loadAccounts = useCallback(async () => {
    if (!runtime) return;
    const generation = ++dataGeneration.current;
    const authAtStart = authGeneration;
    const current = createOperationGuard({
      generation,
      liveGeneration: () => dataGeneration.current,
      authGeneration: authAtStart,
      liveAuthGeneration: () => authGenerationRef.current,
    }).current;
    setBusy(true);
    setError('');
    try {
      const loaded = await loadAllAccounts(runtime.houses);
      if (current()) setAccounts(loaded);
    } catch (cause) {
      if (current()) {
        if (cause instanceof ApiHttpError && cause.status === 401) {
          clearAuthenticatedData();
          setStatus('signedOut');
        }
        setError(messageFor(cause));
      }
    } finally {
      if (current()) setBusy(false);
    }
  }, [runtime, authGeneration]);

  const signOut = async () => {
    if (!runtime) return;
    const authAtStart = authGeneration;
    ++dataGeneration.current;
    ++loadGeneration.current;
    setStatus('signedOut');
    clearAuthenticatedData();
    // clearAuthenticatedData invalidates request generations; capture the new one.
    const signOutGeneration = dataGeneration.current;
    const signOutCurrent = createOperationGuard({
      generation: signOutGeneration,
      liveGeneration: () => dataGeneration.current,
      authGeneration: authAtStart,
      liveAuthGeneration: () => authGenerationRef.current,
    }).current;
    setBusy(true);
    setError('');
    try {
      await runtime.session.logout();
      if (!signOutCurrent()) return;
      setStatus('signedOut');
      router.replace('/');
    } catch (cause) {
      if (!signOutCurrent()) return;
      setStatus('signedOut');
      clearAuthenticatedData();
      setError(`ออกจากระบบในเครื่องแล้ว แต่แจ้งเซิร์ฟเวอร์ไม่สำเร็จ: ${messageFor(cause)}`);
      router.replace('/');
    } finally {
      if (signOutCurrent()) setBusy(false);
    }
  };

  const createHouse = async () => {
    if (!runtime) return;
    const generation = dataGeneration.current;
    const authAtStart = authGeneration;
    const current = createOperationGuard({
      generation,
      liveGeneration: () => dataGeneration.current,
      authGeneration: authAtStart,
      liveAuthGeneration: () => authGenerationRef.current,
    }).current;
    const name = houseName.trim();
    if (!name) return setError('ใส่ชื่อบ้านก่อน');
    setBusy(true);
    setError('');
    try {
      const created = await runtime.houses.create(
        { name, timezone: HOUSEHOLD_TIMEZONE },
        { idempotencyKey: crypto.randomUUID() },
      );
      if (!current()) return;
      setHouseName('');
      setPersistedHouseId(created.id);
      await load();
      if (current()) await loadHouseDetail(created);
    } catch (cause) {
      if (!current()) return;
      if (cause instanceof ApiHttpError && cause.status === 401) {
        clearAuthenticatedData();
        setStatus('signedOut');
      }
      setError(messageFor(cause));
    } finally {
      if (current()) setBusy(false);
    }
  };

  const acceptInvite = async () => {
    if (!runtime) return;
    const generation = dataGeneration.current;
    const authAtStart = authGeneration;
    const current = createOperationGuard({
      generation,
      liveGeneration: () => dataGeneration.current,
      authGeneration: authAtStart,
      liveAuthGeneration: () => authGenerationRef.current,
    }).current;
    const token = invite.trim();
    if (!token) return setError('ใส่รหัสคำเชิญ');
    setBusy(true);
    setError('');
    try {
      await runtime.houses.acceptInvitation({ token }, { idempotencyKey: crypto.randomUUID() });
      if (!current()) return;
      setInvite('');
      setPersistedHouseId(null);
      await load();
    } catch (cause) {
      if (!current()) return;
      if (cause instanceof ApiHttpError && cause.status === 401) {
        clearAuthenticatedData();
        setStatus('signedOut');
      }
      setError(messageFor(cause));
    } finally {
      if (current()) setBusy(false);
    }
  };

  const createInvitation = async () => {
    if (!runtime || !activeHouse) return;
    const targetHouseId = activeHouse.id;
    const generation = dataGeneration.current;
    const authAtStart = authGeneration;
    const current = createOperationGuard({
      generation,
      liveGeneration: () => dataGeneration.current,
      authGeneration: authAtStart,
      liveAuthGeneration: () => authGenerationRef.current,
      targetHouseId,
      liveTargetHouseId: () => activeHouseIdRef.current,
    }).current;
    setBusy(true);
    setError('');
    try {
      const issued = await runtime.houses.issueInvitation(
        targetHouseId,
        { expiresInSeconds: INVITATION_LIFETIME_SECONDS },
        { idempotencyKey: crypto.randomUUID() },
      );
      if (current()) setActiveInvitation(issued);
    } catch (cause) {
      if (!current()) return;
      if (cause instanceof ApiHttpError && cause.status === 401) {
        clearAuthenticatedData();
        setStatus('signedOut');
      } else if (cause instanceof ApiHttpError && [403, 404, 410].includes(cause.status)) {
        clearHouseData(targetHouseId);
      }
      setError(messageFor(cause));
    } finally {
      if (current()) setBusy(false);
    }
  };

  const revokeInvitation = async () => {
    if (!runtime || !activeHouse || !activeInvitation) return;
    const targetHouseId = activeHouse.id;
    const generation = dataGeneration.current;
    const authAtStart = authGeneration;
    const current = createOperationGuard({
      generation,
      liveGeneration: () => dataGeneration.current,
      authGeneration: authAtStart,
      liveAuthGeneration: () => authGenerationRef.current,
      targetHouseId,
      liveTargetHouseId: () => activeHouseIdRef.current,
    }).current;
    setBusy(true);
    setError('');
    try {
      await runtime.houses.revokeInvitation(targetHouseId, activeInvitation.id, {
        idempotencyKey: crypto.randomUUID(),
      });
      if (current()) setActiveInvitation(null);
    } catch (cause) {
      if (!current()) return;
      if (cause instanceof ApiHttpError && cause.status === 401) {
        clearAuthenticatedData();
        setStatus('signedOut');
      } else if (cause instanceof ApiHttpError && [403, 404, 410].includes(cause.status)) {
        clearHouseData(targetHouseId);
      }
      setError(messageFor(cause));
    } finally {
      if (current()) setBusy(false);
    }
  };

  const leaveHouse = async () => {
    if (!runtime || !activeHouse) return;
    const leavingHouseId = activeHouse.id;
    const generation = dataGeneration.current;
    const authAtStart = authGeneration;
    const current = createOperationGuard({
      generation,
      liveGeneration: () => dataGeneration.current,
      authGeneration: authAtStart,
      liveAuthGeneration: () => authGenerationRef.current,
      targetHouseId: leavingHouseId,
      liveTargetHouseId: () => activeHouseIdRef.current,
    }).current;
    setBusy(true);
    setError('');
    try {
      await runtime.houses.leave(leavingHouseId, { idempotencyKey: crypto.randomUUID() });
      if (!current()) return;
      clearHouseData(leavingHouseId);
      await load();
    } catch (cause) {
      if (!current()) return;
      if (cause instanceof ApiHttpError && cause.status === 401) {
        clearAuthenticatedData();
        setStatus('signedOut');
      } else if (cause instanceof ApiHttpError && [403, 404, 410].includes(cause.status)) {
        clearHouseData(leavingHouseId);
      }
      setError(messageFor(cause));
    } finally {
      if (current()) setBusy(false);
    }
  };

  const renameHouse = async () => {
    if (!runtime || !activeHouse) return;
    const targetHouseId = activeHouse.id;
    const generation = dataGeneration.current;
    const authAtStart = authGeneration;
    const current = createOperationGuard({
      generation,
      liveGeneration: () => dataGeneration.current,
      authGeneration: authAtStart,
      liveAuthGeneration: () => authGenerationRef.current,
      targetHouseId,
      liveTargetHouseId: () => activeHouseIdRef.current,
    }).current;
    const name = houseName.trim();
    if (!name) return setError('ใส่ชื่อบ้านก่อน');
    setBusy(true);
    setError('');
    try {
      await runtime.houses.rename(
        targetHouseId,
        { name, timezone: activeHouse.timezone, expectedVersion: activeHouse.version },
        { idempotencyKey: crypto.randomUUID() },
      );
      if (!current()) return;
      await load();
      if (current()) setHouseName('');
    } catch (cause) {
      if (!current()) return;
      if (cause instanceof ApiHttpError && cause.status === 401) {
        clearAuthenticatedData();
        setStatus('signedOut');
      } else if (cause instanceof ApiHttpError && [403, 404, 410].includes(cause.status)) {
        clearHouseData(targetHouseId);
      }
      setError(messageFor(cause));
    } finally {
      if (current()) setBusy(false);
    }
  };

  const saveAccount = async () => {
    if (!runtime) return;
    const generation = dataGeneration.current;
    const authAtStart = authGeneration;
    const current = createOperationGuard({
      generation,
      liveGeneration: () => dataGeneration.current,
      authGeneration: authAtStart,
      liveAuthGeneration: () => authGenerationRef.current,
    }).current;
    setBusy(true);
    setError('');
    try {
      if (accountEditing) {
        await runtime.houses.patchOwnAccount(
          accountEditing.id,
          {
            label: accountLabel.trim(),
            bankCode: bankCode.trim(),
            accountNumber: accountNumber.trim(),
            isDefault: accountDefault,
            active: accountEditing.active,
            expectedVersion: accountEditing.version,
          },
          { idempotencyKey: crypto.randomUUID() },
        );
      } else {
        await runtime.houses.createOwnAccount(
          {
            bankCode: bankCode.trim(),
            label: accountLabel.trim(),
            accountNumber: accountNumber.trim(),
            isDefault: accountDefault,
          },
          { idempotencyKey: crypto.randomUUID() },
        );
      }
      if (!current()) return;
      clearAccountForm();
      const loaded = await loadAllAccounts(runtime.houses);
      if (current()) setAccounts(loaded);
    } catch (cause) {
      if (!current()) return;
      if (cause instanceof ApiHttpError && cause.status === 401) {
        clearAuthenticatedData();
        setStatus('signedOut');
      }
      setError(messageFor(cause));
    } finally {
      if (current()) setBusy(false);
    }
  };

  const clearAccountForm = () => {
    setAccountEditing(null);
    setAccountLabel('');
    setBankCode('');
    setAccountNumber('');
    setAccountDefault(false);
  };

  const beginEditAccount = (account: OwnAccount) => {
    setAccountEditing(account);
    setAccountLabel(account.label);
    setBankCode(account.bankCode);
    setAccountDefault(account.isDefault);
    // The server deliberately returns only masked numbers: never prefill false data.
    setAccountNumber('');
  };

  const changeAccountActive = async (account: OwnAccount) => {
    if (!runtime) return;
    const generation = dataGeneration.current;
    const authAtStart = authGeneration;
    const current = createOperationGuard({
      generation,
      liveGeneration: () => dataGeneration.current,
      authGeneration: authAtStart,
      liveAuthGeneration: () => authGenerationRef.current,
    }).current;
    setBusy(true);
    setError('');
    try {
      await runtime.houses.patchOwnAccount(
        account.id,
        { active: !account.active, expectedVersion: account.version },
        { idempotencyKey: crypto.randomUUID() },
      );
      if (!current()) return;
      const loaded = await loadAllAccounts(runtime.houses);
      if (current()) setAccounts(loaded);
    } catch (cause) {
      if (!current()) return;
      if (cause instanceof ApiHttpError && cause.status === 401) {
        clearAuthenticatedData();
        setStatus('signedOut');
      }
      setError(messageFor(cause));
    } finally {
      if (current()) setBusy(false);
    }
  };

  if (!runtime)
    return (
      <Page>
        <Pill tone="peach">API MODE</Pill>
        <Title>API mode unavailable</Title>
        <Small>Configure the API runtime explicitly. Demo mode has not been substituted.</Small>
      </Page>
    );

  return (
    <Page>
      <Pill tone="mint">API MODE · ไม่มี demo fallback</Pill>
      <Title style={{ marginTop: 14 }}>บ้านของเรา</Title>
      {status === 'loading' && <StateCard title="กำลังตรวจสอบ session และบ้าน…" />}
      {status === 'signedOut' && (
        <Card style={{ marginTop: 14, gap: 9 }}>
          <Label style={{ fontWeight: '700' }}>ยังไม่ได้เข้าสู่ระบบ</Label>
          <Small>Google/Apple ยังไม่พร้อมใช้งาน จึงไม่มี session ปลอม</Small>
          <Button title="ลองตรวจสอบอีกครั้ง" disabled={busy} onPress={() => void load()} />
        </Card>
      )}
      {status === 'error' && (
        <Card style={{ marginTop: 14, gap: 8 }}>
          <Label>เชื่อมต่อไม่ได้</Label>
          <Small>{error}</Small>
          <Button title="ลองใหม่" disabled={busy} onPress={() => void load()} />
        </Card>
      )}
      {status === 'ready' && (
        <>
          <Card style={{ marginTop: 12, gap: 7 }}>
            <Label>บัญชี {profileName || 'ของคุณ'}</Label>
            <Small>รายละเอียดและสมาชิกจะแสดงจากข้อมูล API ที่ได้รับอนุญาตเท่านั้น</Small>
          </Card>
          {error ? <ErrorCard message={error} /> : null}
          {!houses.length ? (
            <Card style={{ marginTop: 12, gap: 10 }}>
              <Label style={{ fontWeight: '700' }}>ยังไม่มีบ้าน</Label>
              <Field label="ชื่อบ้านใหม่" value={houseName} onChangeText={setHouseName} />
              <Button title="สร้างบ้าน" disabled={busy} onPress={() => void createHouse()} />
              <Field
                label="รหัสคำเชิญ"
                value={invite}
                onChangeText={setInvite}
                autoCapitalize="none"
              />
              <Button
                title="เข้าร่วมบ้าน"
                tone="soft"
                disabled={busy}
                onPress={() => void acceptInvite()}
              />
            </Card>
          ) : (
            <>
              <Section title="บ้านที่คุณเข้าถึงได้" />
              <View style={{ gap: 8 }}>
                {houses.map((house) => (
                  <Tap
                    key={house.id}
                    onPress={() => void loadHouseDetail(house)}
                    accessibilityLabel={`เปิดบ้าน ${house.name}`}
                    selected={persistedHouseId === house.id}
                    disabled={busy}
                  >
                    <Card
                      style={{
                        borderColor: persistedHouseId === house.id ? colors.coral : colors.line,
                      }}
                    >
                      <Label style={{ fontWeight: '700' }}>{house.name}</Label>
                      <Small>
                        {house.timezone} · v{house.version}
                        {persistedHouseId === house.id ? ' · เลือกอยู่' : ''}
                      </Small>
                    </Card>
                  </Tap>
                ))}
              </View>
              {activeHouse ? (
                <>
                  <Section title={`สมาชิก · ${activeHouse.name}`} />
                  {members.length ? (
                    <Card>
                      {members.map((member, index) => (
                        <View
                          key={member.id}
                          style={{
                            paddingVertical: 9,
                            borderBottomWidth: index === members.length - 1 ? 0 : 1,
                            borderBottomColor: colors.line,
                          }}
                        >
                          <Label style={{ fontWeight: '700' }}>{member.displayName}</Label>
                          <Small>
                            {member.role === 'owner' ? 'เจ้าของบ้าน' : 'สมาชิก'} ·{' '}
                            {member.active ? 'ใช้งานอยู่' : 'ออกจากบ้าน'} · v{member.version}
                          </Small>
                          {member.role === 'owner' && activeHouse ? (
                            <Small>สิทธิ์จัดการขึ้นกับ API</Small>
                          ) : null}
                        </View>
                      ))}
                    </Card>
                  ) : (
                    <StateCard title="ยังไม่มีสมาชิกในรายการ" />
                  )}
                  <Section title="ตั้งค่าบ้าน" />
                  <Card style={{ gap: 10 }}>
                    <Label style={{ fontWeight: '700' }}>เปลี่ยนชื่อบ้าน</Label>
                    <Field label="ชื่อใหม่" value={houseName} onChangeText={setHouseName} />
                    <Button title="บันทึกชื่อ" disabled={busy} onPress={() => void renameHouse()} />
                    <Button
                      title="ออกจากบ้าน"
                      tone="outline"
                      disabled={busy}
                      onPress={() => void leaveHouse()}
                    />
                  </Card>
                  <Section title="เชิญสมาชิก" />
                  <Card style={{ gap: 10 }}>
                    {activeInvitation ? (
                      <>
                        <Label>ลิงก์คำเชิญ (แสดงครั้งเดียว)</Label>
                        <Text
                          selectable
                          style={{ color: colors.cocoa, fontSize: 14, lineHeight: 22 }}
                        >
                          {activeInvitation.token}
                        </Text>
                        <Small>
                          หมดอายุ {new Date(activeInvitation.expiresAt).toLocaleString()}
                        </Small>
                        <Button
                          title="คัดลอก / แชร์คำเชิญ"
                          disabled={busy}
                          onPress={() => void shareInvitation(activeInvitation.token)}
                        />
                        <Button
                          title="เพิกถอนคำเชิญ"
                          tone="outline"
                          disabled={busy}
                          onPress={() => void revokeInvitation()}
                        />
                      </>
                    ) : (
                      <>
                        <Small>
                          รหัสลับจะแสดงเฉพาะคำตอบการสร้างครั้งนี้ และไม่ถูกเก็บในรายการภายหลัง
                        </Small>
                        <Button
                          title="สร้างคำเชิญ"
                          disabled={busy || !isOwner(members)}
                          onPress={() => void createInvitation()}
                        />
                        {!isOwner(members) ? <Small>เฉพาะเจ้าของบ้านสร้างคำเชิญได้</Small> : null}
                      </>
                    )}
                  </Card>
                </>
              ) : null}
              <Section title="บัญชีรับเงินของฉัน" />
              <Card style={{ gap: 10 }}>
                <Small>ข้อมูลนี้เป็นข้อมูลส่วนตัวของบัญชีที่เข้าสู่ระบบเท่านั้น</Small>
                <Button
                  title="โหลดบัญชีของฉัน"
                  tone="soft"
                  disabled={busy}
                  onPress={() => void loadAccounts()}
                />
                {accounts.map((account) => (
                  <View
                    key={account.id}
                    style={{
                      borderTopWidth: 1,
                      borderTopColor: colors.line,
                      paddingTop: 10,
                      gap: 7,
                    }}
                  >
                    <Label style={{ fontWeight: '700' }}>
                      {account.label} · {account.bankCode}
                    </Label>
                    <Small>
                      {account.maskedAccount} · {account.isDefault ? 'บัญชีหลัก' : 'บัญชีสำรอง'} ·{' '}
                      {account.active ? 'เปิด' : 'เก็บถาวร'}
                    </Small>
                    <Button
                      title="แก้ไข"
                      tone="outline"
                      disabled={busy}
                      onPress={() => beginEditAccount(account)}
                    />
                    <Button
                      title={account.active ? 'เก็บบัญชี' : 'เปิดใช้อีกครั้ง'}
                      tone="outline"
                      disabled={busy}
                      onPress={() => void changeAccountActive(account)}
                    />
                  </View>
                ))}
                <AccountForm
                  editing={accountEditing}
                  label={accountLabel}
                  setLabel={setAccountLabel}
                  bankCode={bankCode}
                  setBankCode={setBankCode}
                  accountNumber={accountNumber}
                  setAccountNumber={setAccountNumber}
                  isDefault={accountDefault}
                  setIsDefault={setAccountDefault}
                  busy={busy}
                  onSave={() => void saveAccount()}
                  onCancel={clearAccountForm}
                />
              </Card>
            </>
          )}
          <Card style={{ marginTop: 14, gap: 8 }}>
            <Button
              title="ออกจากระบบ"
              tone="outline"
              disabled={busy}
              onPress={() => void signOut()}
            />
          </Card>
        </>
      )}
    </Page>
  );
}

function AccountForm({
  editing,
  label,
  setLabel,
  bankCode,
  setBankCode,
  accountNumber,
  setAccountNumber,
  isDefault,
  setIsDefault,
  busy,
  onSave,
  onCancel,
}: {
  editing: OwnAccount | null;
  label: string;
  setLabel: (value: string) => void;
  bankCode: string;
  setBankCode: (value: string) => void;
  accountNumber: string;
  setAccountNumber: (value: string) => void;
  isDefault: boolean;
  setIsDefault: (value: boolean) => void;
  busy: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <View style={{ gap: 10, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 }}>
      <Label style={{ fontWeight: '700' }}>
        {editing ? 'แก้ไขบัญชี (กรอกเลขใหม่เพื่อเปลี่ยน)' : 'เพิ่มบัญชีรับเงิน'}
      </Label>
      <Field label="ชื่อบัญชี" value={label} onChangeText={setLabel} />
      <Field
        label="รหัสธนาคาร"
        value={bankCode}
        onChangeText={setBankCode}
        autoCapitalize="characters"
      />
      <Field
        label="เลขบัญชี"
        value={accountNumber}
        onChangeText={setAccountNumber}
        keyboardType="number-pad"
        secureTextEntry
      />
      <Button
        title={isDefault ? 'บัญชีหลัก ✓' : 'ตั้งเป็นบัญชีหลัก'}
        tone="soft"
        disabled={busy}
        onPress={() => setIsDefault(!isDefault)}
      />
      <Button title={editing ? 'บันทึกการแก้ไข' : 'สร้างบัญชี'} disabled={busy} onPress={onSave} />
      {editing ? (
        <Button title="ยกเลิกแก้ไข" tone="outline" disabled={busy} onPress={onCancel} />
      ) : null}
    </View>
  );
}

function Section({ title }: { title: string }) {
  return (
    <Title style={{ fontSize: 19, lineHeight: 28, marginTop: 23, marginBottom: 9 }}>{title}</Title>
  );
}

function StateCard({ title }: { title: string }) {
  return (
    <Card style={{ marginTop: 12 }}>
      <Label>{title}</Label>
    </Card>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <Card style={{ marginTop: 10, borderColor: colors.error }}>
      <Small style={{ color: colors.error }}>{message}</Small>
    </Card>
  );
}

function isOwner(members: Member[]): boolean {
  return members.some((member) => member.role === 'owner' && member.active);
}

function messageFor(error: unknown): string {
  if (error instanceof ApiHttpError) return `${error.status} · ${error.error.message}`;
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
}

async function shareInvitation(token: string) {
  const url = `ourhoomu://invite/${encodeURIComponent(token)}`;
  try {
    await Share.share({ message: url, url });
  } catch {
    try {
      await navigator.clipboard.writeText(url);
      Alert.alert('คัดลอกแล้ว', 'ลิงก์คำเชิญอยู่ในคลิปบอร์ด');
    } catch {
      Alert.alert('คัดลอกไม่ได้', 'กรุณาลองแชร์ลิงก์อีกครั้ง');
    }
  }
}

async function loadAllHouses(
  repository: NonNullable<ReturnType<typeof useAppRuntime>['runtime']>['houses'],
): Promise<House[]> {
  let page = await repository.list({ limit: 100 });
  const all = [...page.data];
  while (page.nextCursor) {
    page = await repository.list({ cursor: page.nextCursor, limit: 100 });
    all.push(...page.data);
  }
  return all;
}

async function loadAllAccounts(
  repository: NonNullable<ReturnType<typeof useAppRuntime>['runtime']>['houses'],
): Promise<OwnAccount[]> {
  let page = await repository.listOwnAccounts({ limit: 100 });
  const all = [...page.data];
  while (page.nextCursor) {
    page = await repository.listOwnAccounts({ cursor: page.nextCursor, limit: 100 });
    all.push(...page.data);
  }
  return all;
}
