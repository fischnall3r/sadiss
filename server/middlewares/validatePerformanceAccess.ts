import { Request, Response, NextFunction } from 'express'
import { SadissPerformance } from '../models/sadissPerformance'
import { isValidObjectId } from 'mongoose'

export const validatePerformanceAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const performanceId = req.body.performanceId

    if (!performanceId || !isValidObjectId(performanceId)) {
      return res.status(400).json({ error: 'Invalid input data' })
    }

    const performance = await SadissPerformance.findById(performanceId).lean()

    if (!performance) {
      return res.status(404).json({ error: 'Performance not found' })
    }

    if (performance.creator.toString() !== req.user?._id.toString()) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    next()
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
}
