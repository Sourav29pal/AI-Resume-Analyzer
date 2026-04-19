const pdfParse = require("pdf-parse");
const { generateInterviewReport } = require("../services/ai.service");
const interviewReportModel = require("../models/interviewReport.model");

/**
 * @description Controller to generate interview report based on user self description, resume and job description.
 */
async function generateInterviewReportController(req, res) {
    try {
        // 1. Validate file upload
        if (!req.file || !req.file.buffer) {
            return res.status(400).json({ message: "No PDF file uploaded." });
        }

        // 2. Extract text from the PDF
        const pdfData = await pdfParse(req.file.buffer);
        const resumeText = pdfData.text;

        const { selfDescription, jobDescription } = req.body;

        // 3. Call AI Service to get structured data
        const aiResponse = await generateInterviewReport({
            resume: resumeText,
            selfDescription,
            jobDescription,
        });

        // 4. Create Database Entry
        const interviewReport = await interviewReportModel.create({
            user: req.user.id || req.user._id, // Supports both passport.js and custom JWT user objects
            resume: resumeText,
            selfDescription,
            jobDescription,
            ...aiResponse,
        });

        // 5. Send Success Response
        return res.status(201).json({
            message: "Interview report generated successfully.",
            interviewReport,
        });
    } catch (error) {
        console.error("Controller Error:", error);
        return res.status(500).json({
            message: "Error processing request",
            details: error.message,
        });
    }
}

/**
 * @description Controller to get interview report by interviewId.
 */
async function getInterviewReportByIdController(req, res) {
    const { interviewId } = req.params;
    
    // 1. Grab the user ID safely, just like in your create controller
    const userId = req.user.id || req.user._id;

    // 2. Use the safe userId for the query
    const interviewReport = await interviewReportModel.findOne({ 
        _id: interviewId, 
        user: userId 
    });

    if (!interviewReport) {
        return res.status(404).json({
            message: "Interview report not found.",
        });
    }

    res.status(200).json({
        message: "Interview report fetched successfully.",
        interviewReport,
    });
}

/**
 * @description Controller to get all interview reports of logged in user.
 */
async function getAllInterviewReportsController(req, res) {
    // Safely grab the user ID here too!
    const userId = req.user.id || req.user._id;

    const interviewReports = await interviewReportModel
        .find({ user: userId })
        .sort({ createdAt: -1 })
        .select("-resume -selfDescription -jobDescription -__v -technicalQuestions -behavioralQuestions -skillGaps -preparationPlan");

    res.status(200).json({
        message: "Interview reports fetched successfully.",
        interviewReports,
    });
}

/**
 * @description Controller to generate resume PDF based on user self description, resume and job description.
 */
async function generateResumePdfController(req, res) {
    const { interviewReportId } = req.params;

    const interviewReport = await interviewReportModel.findById(interviewReportId);

    if (!interviewReport) {
        return res.status(404).json({
            message: "Interview report not found.",
        });
    }

    const { resume, jobDescription, selfDescription } = interviewReport;

    const pdfBuffer = await generateResumePdf({ resume, jobDescription, selfDescription });

    res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=resume_${interviewReportId}.pdf`,
    });

    res.send(pdfBuffer);
}

module.exports = {
    generateInterviewReportController,
    getInterviewReportByIdController,
    getAllInterviewReportsController,
    generateResumePdfController,
};
