import mongoose from "mongoose";
import Report from "../models/Report.js";
import dotenv from "dotenv";
dotenv.config()


const MONGO_URI = process.env.MONGO_URI
async function fixReport() {
    await mongoose.connect(MONGO_URI)

    const report = await Report.findOne()

    if (!report) {
        console.log('No report found')
        return
    }
    // report.status = 'failed'
    // report.errorMessage = 'Manual fix: worker failed but status was not updated'
    //report.poeticLine = "Time keeps its quiet ledger, and your careful practice adds up into steadier momentum."

    await report.save()

    console.log('Report updated:', report._id)
    await mongoose.disconnect()
}

fixReport().catch(console.error)