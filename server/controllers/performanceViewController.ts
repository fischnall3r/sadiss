import { Request, Response } from 'express'
import { SadissPerformance } from '../models/sadissPerformance'
import { TrackPerformance } from '../models/trackPerformance'

export const getPerformanceWithTracks = async (req: Request, res: Response) => {
  try {
    const performance = await SadissPerformance.findById(req.params.id, 'name creator tracks')
      .populate('creator', 'username -_id')
      .lean()

    if (!performance) {
      return res.status(404).json({ error: 'Performance not found' })
    }

    const trackPerformances = await TrackPerformance.find(
      { performance: performance._id, deleted: { $ne: true } },
      'track _id sortOrder startTime'
    )
      .populate('track', 'name notes mode waveform ttsRate creator isPublic partialFile ttsFiles chunkFileName partialsCount')
      .lean()

    trackPerformances.sort((a, b) => {
      const orderA = a.sortOrder
      const orderB = b.sortOrder

      // Tracks without a sortOrder value come last
      if (orderA === undefined && orderB === undefined) {
        return 0
      } else if (orderA === undefined) {
        return 1
      } else if (orderB === undefined) {
        return -1
      }

      // Sort by sortOrder in ascending order
      return orderA - orderB
    })

    const tracks = trackPerformances.map((trackPerformance) => {
      const track = trackPerformance.track
      const trackPerformanceId = trackPerformance._id
      const sortOrder = trackPerformance.sortOrder
      const startTime = trackPerformance.startTime || 0

      return { ...track, trackPerformanceId, sortOrder, startTime }
    })

    res.json({ performance: { ...performance, tracks } })
  } catch (err) {
    res.status(500).json({ Error: 'Failed fetching performance.' })
  }
}
