import express from 'express'
import passport from 'passport'
import { authenticateToken } from '../auth'
import { validatePerformanceAccess } from '../middlewares/validatePerformanceAccess'
import { validateTrackAccess } from '../middlewares/validateTrackAccess'
import { validateLoginInput } from '../middlewares/validateLoginInput'
import {
  deleteTrack,
  startTrack,
  downloadTrack,
  editTrack,
  getTrack,
  stopTrack,
  uploadTrack,
  uploadZip,
  handleLoadTrackForPlayback,
  getTracks
} from '../controllers/trackController'
import {
  getPerformances,
  getOwnPerformances,
  getPerformance,
  createPerformance,
  deletePerformance,
  editPerformance,
  getClientCountPerChoirId
} from '../controllers/performanceController'
import {
  addTracksToPerformance,
  updateTrackPerformanceOrder,
  updateStartTime,
  deleteTrackFromPerformance
} from '../controllers/trackPerformanceController'
import { getPerformanceWithTracks } from '../controllers/performanceViewController'
import { login, register, isLoggedIn, logout } from '../controllers/authController'

const router = express.Router()

import multer from 'multer'

const upload = multer({ dest: `${process.env.UPLOADS_DIR}/` })

router.use('/api', authenticateToken)

// Upload track
router.post('/api/track/create', upload.array('files'), uploadTrack)

// Edit track
router.post('/api/track/edit/:id', upload.array('files'), editTrack)

// Get tracks
router.get('/api/tracks', getTracks)

// Get track
router.get('/api/track/:id', getTrack)

// Delete track
router.post('/api/track/delete/:id', deleteTrack)

// Start track
router.post('/api/track/start', startTrack)

// Stop track
router.post('/api/track/stop', stopTrack)

// Load track for playback
router.post('/api/track/load', handleLoadTrackForPlayback)

// Download track
router.get('/api/track/download/:trackId', downloadTrack)

// Upload zip (downloaded via above route, most likely)
router.post('/api/track/upload-zip', upload.single('file'), uploadZip)

/* PERFORMANCE */
// Get performances
router.get('/api/performances', getPerformances)

// Get own performances
router.get('/api/own-performances', getOwnPerformances)

// Get performance
router.get('/api/performance/:id', getPerformance)

// Create performance
router.post('/api/performance/create', createPerformance)

// Delete performance
router.post('/api/performance/delete/:id', deletePerformance)

// Edit performance
router.post('/api/performance/edit/:id', editPerformance)

// Get clients per choir id
router.get('/api/client-count-per-choir-id/:performanceId', getClientCountPerChoirId)

/* TRACKPERFORMANCE */
// Add track to performance
router.post('/api/add-tracks-to-performance', addTracksToPerformance)
// Update sortOrder of trackPerformance
router.post('/api/track-performance/update-order', updateTrackPerformanceOrder)

router.post('/api/track-performance/set-start-time', updateStartTime)

router.post('/api/track-performance/delete', deleteTrackFromPerformance)

/* PERFORMANCE VIEW */
// Get performance with tracks
router.get('/api/performance/:id/with-tracks', getPerformanceWithTracks)

/* AUTH */
// Login
router.post('/login', validateLoginInput, passport.authenticate('local', { session: false }), login)

// Register
router.post('/register', register)

// Is logged in
router.get('/is-logged-in', authenticateToken, isLoggedIn)

// Logout
router.get('/logout', logout)

export default router
