import { Request, Response, NextFunction } from 'express'
import { Track } from '../models/track'
import { isValidObjectId } from 'mongoose'

export const validateTrackAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const trackIds = req.body.trackIds

    if (!trackIds || trackIds.some((trackId: string) => !trackId || !isValidObjectId(trackId))) {
      return res.status(400).json({ error: 'Invalid input data' })
    }

    const tracks = await Track.find({ _id: { $in: trackIds } }).lean()

    if (tracks.length !== trackIds.length) {
      return res.status(404).json({ error: 'One or more tracks not found' })
    }

    const unauthorized = tracks.some((track) => !track.isPublic && track.creator.toString() !== req.user!._id.toString())

    if (unauthorized) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    next()
  } catch (error) {
    res.status(500).json({ error: 'Server error' })
  }
}
