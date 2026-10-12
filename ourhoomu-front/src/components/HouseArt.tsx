import React, { useEffect, useRef } from 'react';
import { Animated, Platform, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { useReducedMotion } from './ui';

export function HouseArt({ size = 178 }: { size?: number }) {
  const reduced = useReducedMotion();
  const sway = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const sequence = Animated.sequence([
      Animated.timing(sway, { toValue: 1, duration: 850, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(sway, { toValue: 0, duration: 950, useNativeDriver: Platform.OS !== 'web' }),
    ]);
    sequence.start();
    return () => sequence.stop();
  }, [reduced, sway]);
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} viewBox="0 0 180 180">
        <Ellipse cx="91" cy="153" rx="73" ry="12" fill="#EDB8A8" opacity="0.38" />
        <Circle cx="40" cy="38" r="15" fill="#FFD87B" />
        <Path
          d="M42 88 L91 43 L141 88"
          fill="none"
          stroke="#8A5B51"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M48 83 L91 45 L135 83 L135 146 Q135 152 128 152 L54 152 Q48 152 48 146 Z"
          fill="#FFF6E8"
          stroke="#8A5B51"
          strokeWidth="3"
        />
        <Path
          d="M47 85 L91 44 L135 85"
          fill="#E98D78"
          stroke="#8A5B51"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <Rect x="76" y="106" width="28" height="46" rx="12" fill="#C7816D" />
        <Circle cx="97" cy="130" r="2.4" fill="#FFF6E8" />
        <Rect
          x="57"
          y="95"
          width="19"
          height="22"
          rx="7"
          fill="#BDE1D2"
          stroke="#8A5B51"
          strokeWidth="2"
        />
        <Rect
          x="109"
          y="95"
          width="19"
          height="22"
          rx="7"
          fill="#BDE1D2"
          stroke="#8A5B51"
          strokeWidth="2"
        />
        <Path d="M119 95 V117 M109 106 H128" stroke="#8A5B51" strokeWidth="2" />
        <Path d="M65 96 V117 M57 107 H76" stroke="#8A5B51" strokeWidth="2" />
        <Path
          d="M28 148 Q20 135 27 125 Q34 128 34 144 M29 145 Q38 128 46 136 Q43 149 32 151"
          fill="#75AD8B"
          stroke="#4F806A"
          strokeWidth="2"
        />
        <Path
          d="M147 151 Q139 133 147 127 Q155 137 151 151 M150 149 Q159 134 167 140 Q163 152 151 153"
          fill="#75AD8B"
          stroke="#4F806A"
          strokeWidth="2"
        />
        <Path d="M18 153 H165" stroke="#8A5B51" strokeWidth="3" strokeLinecap="round" />
      </Svg>
      <Animated.View
        style={{
          position: 'absolute',
          top: size * 0.1,
          right: size * 0.08,
          transform: [
            { rotate: sway.interpolate({ inputRange: [0, 1], outputRange: ['-9deg', '10deg'] }) },
          ],
        }}
      >
        <Svg width={25} height={27}>
          <Path d="M12 24 C2 14 4 4 18 3 C22 13 19 21 12 24Z" fill="#8BC5A3" />
          <Path d="M12 23 L17 8" stroke="#5B9773" strokeWidth="2" />
        </Svg>
      </Animated.View>
    </View>
  );
}
