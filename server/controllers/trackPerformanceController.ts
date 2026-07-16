import { Request, Response } from 'express'
import { TrackPerformance } from '../models/trackPerformance'
import { SadissPerformance, Track } from '../models'
import { Types } from 'mongoose'
import { isValidObjectId } from 'mongoose'
import { unloadTrackFromActivePerformance } from '../services/activePerformanceService'
import { setStartTime } from '../services/trackPerformanceService'
import { InvalidInputError, ProcessingError } from '../errors'

export const addTracksToPerformance = async (req: Request, res: Response) => {
  try {
    const { trackIds, performanceId } = req.body

    if (!performanceId || !isValidObjectId(performanceId)) {
      return res.status(400).send({ error: 'Please provide a valid performanceId' })
    }

    if (!trackIds || !trackIds.length) {
      return res.status(400).send({ error: 'Please provide at least one track' })
    }

    const performance = await SadissPerformance.findById(performanceId)

    if (!performance) {
      return res.status(404).send({ error: 'Performance not found' })
    }

    // If performance is public check if all tracks are public
    if (performance.isPublic) {
      const tracks = await Track.find({ _id: { $in: trackIds } })

      if (tracks.length !== trackIds.length) {
        return res.status(404).send({ error: 'One or more tracks not found' })
      }

      const privateTrack = tracks.find((track) => !track.isPublic)
      if (privateTrack) {
        return res.status(400).send({ message: 'Cannot add private track to public performance' })
      }
    }

    const trackPerformancesCount = await TrackPerformance.countDocuments({ performance: performanceId })
    let sortOrder = trackPerformancesCount + 1
    const startTime = 0

    const trackPerformances = trackIds.map((trackId: string) => ({
      track: trackId,
      performance: performanceId,
      sortOrder: sortOrder++,
      startTime
    }))

    const insertedDocuments = await TrackPerformance.insertMany(trackPerformances)
    const sanitizedDocuments = insertedDocuments.map((doc) => {
      const { createdAt, updatedAt, __v, ...rest } = doc.toObject()
      return rest
    })
    res.status(201).send({ trackPerformances: sanitizedDocuments })
  } catch (error) {
    res.status(500).send({ error: 'Server error' })
  }
}

export const updateTrackPerformanceOrder = async (req: Request, res: Response) => {
  try {
    interface TrackPerformanceIdAndSortOrder {
      trackPerformanceId: Types.ObjectId
      sortOrder: number
    }

    const { trackPerformances }: { trackPerformances: TrackPerformanceIdAndSortOrder[] } = req.body

    // Check if the provided data is valid
    const someInputDataIsInvalid = trackPerformances.some(
      (trackPerformance: TrackPerformanceIdAndSortOrder) =>
        !trackPerformance.trackPerformanceId ||
        !trackPerformance.sortOrder ||
        !isValidObjectId(trackPerformance.trackPerformanceId)
    )
    if (someInputDataIsInvalid) {
      return res.status(400).send({ error: 'Invalid input data' })
    }

    // Update the sortOrder of each trackPerformance
    for (const trackPerformance of trackPerformances) {
      await TrackPerformance.findByIdAndUpdate(trackPerformance.trackPerformanceId, {
        sortOrder: trackPerformance.sortOrder
      })
    }

    res.status(200).send({ message: 'Track performance order updated' })
  } catch (error: any) {
    res.status(500).send({ error: `Server error: ${error}` })
  }
}

export const deleteTrackFromPerformance = async (req: Request, res: Response) => {
  try {
    const { trackPerformanceId } = req.body

    // Check if the provided data is valid
    if (!trackPerformanceId || !isValidObjectId(trackPerformanceId)) {
      return res.status(400).send({ error: 'Invalid input data' })
    }

    // Soft delete the TrackPerformance record
    const trackPerformance = await TrackPerformance.findById(trackPerformanceId)
    if (!trackPerformance) {
      return res.status(404).send({ error: 'Track performance not found' })
    }

    trackPerformance.deleted = true
    trackPerformance.deletedAt = new Date()
    trackPerformance.deletedBy = req.user!._id
    await trackPerformance.save()

    unloadTrackFromActivePerformance(trackPerformanceId)

    res.status(200).send({ message: 'Track performance deleted' })
  } catch (error) {
    res.status(500).send({ error: 'Server error' })
  }
}

export const updateStartTime = async (req: Request, res: Response) => {
  try {
    const { trackPerformanceId, startTime } = req.body

    if (!trackPerformanceId || !isValidObjectId(trackPerformanceId)) {
      return res.status(400).send({ error: 'Please provide a valid trackPerformanceId' })
    }

    if (!startTime || !Number.isInteger(startTime)) {
      return res.status(400).send({ error: 'Please provide a valid startTime' })
    }

    const trackPerformance = await setStartTime(trackPerformanceId, startTime)

    res.status(200).send({ message: 'Start time updated', trackPerformance })
  } catch (error) {
    if (error instanceof InvalidInputError) {
      return res.status(400).send({ error: error.message })
    }
    if (error instanceof ProcessingError) {
      return res.status(500).send({ error: error.message })
    }
    return res.status(500).send({ error: 'Server error' })
  }
}

// Currently unused?
// exports.getTracksOfPerformance = async (req: Request, res: Response) => {
//   try {
//     const { id } = req.params

//     // Check if the provided ID is valid
//     if (!id) {
//       return res.status(400).json({ error: 'Invalid input data' })
//     }

//     // Find all TrackPerformance records with the provided performanceId
//     const trackPerformances = await TrackPerformance.find({ performanceId: id })

//     // If no TrackPerformance records were found, return an error
//     if (!trackPerformances) {
//       return res.status(404).json({ error: 'No tracks found' })
//     }

//     // Get the tracks of the found TrackPerformance records
//     const tracks = trackPerformances.map((trackPerformance) => trackPerformance.track)

//     // Return the found TrackPerformance records
//     res.status(200).json({ tracks })
//   } catch (error) {
//     res.status(500).json({ error: 'Server error' })
//   }
// }
