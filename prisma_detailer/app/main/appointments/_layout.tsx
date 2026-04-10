import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { Stack } from 'expo-router'

const AppointmentLayout = () => {
  return (
    <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name='AppointmentCalendarScreen' options={{ headerShown: false }} />
        <Stack.Screen name='AppointmentDetailsScreen' options={{ headerShown: false }} />
        <Stack.Screen name='AppointmentDailyScreen' options={{ headerShown: false }} />
    </Stack>
  )
}

export default AppointmentLayout

const styles = StyleSheet.create({})