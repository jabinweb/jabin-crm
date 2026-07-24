'use client'

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock } from "lucide-react"
import { AttendanceStatus } from "@prisma/client"
import { PageHeaderSkeleton, SectionSkeleton } from "@/components/loading"

interface Attendance {
  id: string
  createdAt: string
  checkIn: string | null
  checkOut: string | null
  status: AttendanceStatus
  overtime: number | null
}

export default function AttendancePage() {
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [isCheckedIn, setIsCheckedIn] = useState(false)
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState<Date>(new Date())

  useEffect(() => {
    fetchAttendance()
  }, [])

  const fetchAttendance = async () => {
    try {
      const response = await fetch('/api/employee/attendance')
      if (!response.ok) throw new Error('Failed to fetch attendance')
      const data = await response.json()
      setAttendance(data)
      
      // Check if user is currently checked in (has checkIn but no checkOut)
      const activeAttendance = data.find((a: Attendance) => 
        a.checkIn && !a.checkOut
      )
      setIsCheckedIn(!!activeAttendance)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleClockInOut = async () => {
    try {
      const response = await fetch('/api/employee/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: isCheckedIn ? 'clockOut' : 'clockIn' })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        console.error('API Error:', errorData)
        throw new Error(errorData.error || 'Failed to update attendance')
      }
      
      const result = await response.json()
      console.log('Attendance updated:', result)
      await fetchAttendance()
    } catch (error) {
      console.error('Clock in/out error:', error)
      // You might want to show a toast or alert here
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <PageHeaderSkeleton />
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Time Clock</CardTitle>
            </CardHeader>
            <CardContent>
              <SectionSkeleton lines={4} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Monthly Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <SectionSkeleton lines={6} />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Attendance</h1>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Time Clock</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
            <div className="text-4xl font-bold">
              {new Date().toLocaleTimeString()}
            </div>
            <Button 
              size="lg" 
              onClick={handleClockInOut}
              className="w-full max-w-xs"
            >
              <Clock className="mr-2 h-4 w-4" />
              {isCheckedIn ? 'Clock Out' : 'Clock In'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={date}
              onSelect={(date) => date && setDate(date)}
              className="rounded-md border"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
