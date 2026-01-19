// scripts/delete-user.js
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import User from '../models/User.js'

dotenv.config()


const MONGO_URI = process.env.MONGO_URI

async function run() {
    try {
        console.log('🔌 Connecting to MongoDB...')
        await mongoose.connect(MONGO_URI)

        const email = process.argv[2]

        if (!email) {
            console.error('❌ Please provide user email:')
            console.error('👉 Example: node scripts/delete-user.js demo@test.com')
            process.exit(1)
        }

        console.log(`🔍 Finding user by email: ${email}`)

        const user = await User.findOne({ email })

        if (!user) {
            console.log('⚠️ User not found.')
            process.exit(0)
        }

        await User.deleteOne({ _id: user._id })

        console.log('✅ User deleted successfully:')
        console.log({
            id: user._id.toString(),
            email: user.email,
            username: user.username,
        })

        process.exit(0)
    } catch (err) {
        console.error('❌ Script failed:', err)
        process.exit(1)
    }
}

run()
