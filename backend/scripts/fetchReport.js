// scripts/fetchLatestReport.js
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Report from '../models/Report.js'

dotenv.config()
const MONGO_URI = process.env.MONGO_URI

async function main() {
    try {
        console.log('🔌 Connecting to MongoDB...')
        await mongoose.connect(MONGO_URI)
        console.log('✅ Connected to MongoDB')

        //Fetch the last report
        const latestReport = await Report.findOne({})
            .sort({ startDate: -1 })
            .lean()
            .exec()

        if (!latestReport) {
            console.log('⚠️ No report found in the database.')
        } else {
            console.log('📝 Latest report:')
            console.log(JSON.stringify(latestReport, null, 2))
        }

        //delete the last report
        // const { _id, userId, periodKey } = latestReport
        // const result = await Report.deleteOne({ _id })
        // if (result.deletedCount === 1) {
        //     console.log(`✅ Deleted report [${_id}] for user ${userId} (${periodKey})`)
        // } else {
        //     console.log(`❌ Failed to delete report [${_id}]`)
        // }

        await mongoose.disconnect()
        console.log('🔌 Disconnected from MongoDB')
    } catch (err) {
        console.error('❌ Error:', err)
    }
}

main()