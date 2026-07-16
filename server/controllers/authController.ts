import jwt from 'jsonwebtoken'
import { Request, Response } from 'express'
import { User } from '../models/user'
import { env } from 'process'
import { authenticateUser, generateToken } from '../services/authService'
import bcrypt from 'bcryptjs'
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

export const register = async (req: Request, res: Response) => {
  try {
    const { username, password, email } = req.body
    const existingUser = await User.findOne({ $or: [{ username: username }, { email: email }] })
    if (existingUser) {
      return res.status(409).send({ message: 'Username already exists' })
    }
    const hashedPassword = await bcrypt.hash(password, 10)
    const user = new User({ username, password: hashedPassword, email })
    await user.save()
    if (env.NODE_ENV === 'test') {
      return res.status(201).send(user)
    } else {
      res.status(201).send({ message: 'User created successfully' })
    }
  } catch (err) {
    res.status(500).send({ message: 'Failed to create user' })
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
