import mongoose from 'mongoose'
import dotenv from 'dotenv'
import User from '../models/User.js'
import Note from '../models/Note.js'
dotenv.config()


const MONGO_URI = process.env.MONGO_URI



const NOTE_ID = ''


const TARGET_DATE = ''

const DEMO_EMAIL = process.env.DEMO_USER_EMAIL

async function run() {
    try {
        await mongoose.connect(MONGO_URI)
        console.log('✅ Mongo connected')

        const user = await User.findOne({ email: DEMO_EMAIL })
        if (!user) {
            console.error('❌ Demo user not found')
            return
        }

        console.log('👤 Demo user:', {
            id: user._id.toString(),
            email: user.email,
        })

        // get current notes
        const notes = await Note.find({ userId: user._id })
            .select('title createdAt')
            .sort({ createdAt: 1 })

        console.log(`📄 Found ${notes.length} notes:`)

        notes.forEach(n => {
            console.log(
                `- ${n._id} | ${n.title} | ${n.createdAt.toISOString()}`
            )
        })

        const newDate = new Date(TARGET_DATE)
        if (isNaN(newDate.getTime())) {
            console.error('❌ Invalid TARGET_DATE format')
            process.exit(1)
        }

        const objectId = new mongoose.Types.ObjectId(NOTE_ID)

        const result = await Note.collection.updateOne(
            { _id: objectId },
            { $set: { createdAt: newDate } }
        )

        console.log("🧪 Update result:", result)

        const updated = await Note.findById(NOTE_ID).select('createdAt')

        console.log('✅ After update:')
        console.log({
            id: NOTE_ID,
            createdAt: updated.createdAt,
        })

        console.log('🎉 Date updated successfully')

        await mongoose.disconnect()
        process.exit(0)
    } catch (err) {
        console.error('❌ Script failed:', err)
        await mongoose.disconnect()
        process.exit(1);
    }
}
run()
