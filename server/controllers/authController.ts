import { Request, Response } from 'express'
import { generateToken } from '../services/authService'
import { NotFoundError } from '../errors'

export const login = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      // Passport somehow didn't find a user, should not happen
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const token = generateToken(req.user._id.toString())

    const secureOption = process.env.NODE_ENV === 'production'

    res
      .cookie('jwt', token, {
        httpOnly: true,
        secure: secureOption,
        //@ts-ignore 'Strict' seems to be correct here, not 'strict'
        sameSite: 'Strict',
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24) // 1 day
      })
      .json({ message: 'Login successful' })
  } catch (err) {
    if (err instanceof NotFoundError) {
      return res.status(404).end()
    } else {
      res.status(500)
    }
  }
}

export const isLoggedIn = async (req: Request, res: Response) => {
  try {
    res.json({ message: 'Logged in', userId: req.user?._id })
  } catch (err) {
    res.status(500).json({ message: 'Failed to check login status' })
  }
}

export const logout = async (req: Request, res: Response) => {
  try {
    res.clearCookie('jwt').json({ message: 'Logged out' })
  } catch (err) {
    res.status(500).json({ message: 'Failed to logout' })
  }
}
