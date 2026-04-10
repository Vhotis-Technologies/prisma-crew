import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { Stack } from 'expo-router'

const EarningLayout = () => {
  return (
    <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name='EarningScreen' options={{ headerShown: false }} />
    </Stack>
  )
}

export default EarningLayout

const styles = StyleSheet.create({})