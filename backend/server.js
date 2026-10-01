const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const CloudConvert = require("cloudconvert");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";
const API_KEY = process.env.CLOUDCONVERT_API_KEY;

if (!API_KEY) {
  console.error("ERROR: CLOUDCONVERT_API_KEY is missing.");
  process.exit(1);
}

const cloudConvert = new CloudConvert(API_KEY);

// Upload directory
const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer
const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 50 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF files are allowed."));
    }

    cb(null, true);
  }
});

// Frontend
app.use(
  express.static(
    path.join(__dirname, "..", "frontend")
  )
);

// Health check
app.get("/healthz", (req, res) => {
  res.status(200).send("OK");
});

// PDF compression
app.post(
  "/api/compress-pdf",
  upload.single("file"),
  async (req, res) => {
    let localFile = null;

    try {
      if (!req.file) {
        return res.status(400).json({
          error: "No PDF file was uploaded."
        });
      }

      localFile = req.file.path;

      const originalSize = req.file.size;

      const preset = req.body.preset || "web";

      const allowedProfiles = [
        "web",
        "print",
        "archive",
        "mrc",
        "max"
      ];

      const profile = allowedProfiles.includes(preset)
        ? preset
        : "web";

      const job = await cloudConvert.jobs.create({
        tasks: {
          "upload-pdf": {
            operation: "import/upload"
          },

          "compress-pdf": {
            operation: "optimize",
            input: "upload-pdf",
            input_format: "pdf",
            profile: profile
          },

          "export-pdf": {
            operation: "export/url",
            input: "compress-pdf"
          }
        }
      });

      const uploadTask = job.tasks.find(
        task => task.name === "upload-pdf"
      );

      if (!uploadTask) {
        throw new Error(
          "CloudConvert upload task was not created."
        );
      }

      await cloudConvert.tasks.upload(
        uploadTask,
        fs.createReadStream(localFile),
        req.file.originalname
      );

      const finishedJob =
        await cloudConvert.jobs.wait(job.id);

      const exportedFiles =
        cloudConvert.jobs.getExportUrls(
          finishedJob
        );

      if (
        !exportedFiles ||
        exportedFiles.length === 0
      ) {
        throw new Error(
          "CloudConvert did not return an output file."
        );
      }

      const outputFile = exportedFiles[0];

      const downloadUrl = outputFile.url;

      const filename =
        outputFile.filename ||
        `compressed-${req.file.originalname}`;

      let compressedSize = null;

      const optimizeTask =
        finishedJob.tasks.find(
          task => task.name === "compress-pdf"
        );

      if (
        optimizeTask &&
        optimizeTask.result &&
        optimizeTask.result.files &&
        optimizeTask.result.files[0]
      ) {
        compressedSize =
          optimizeTask.result.files[0].size || null;
      }

      res.json({
        success: true,
        originalSize,
        compressedSize,
        downloadUrl,
        filename,
        profile
      });

    } catch (error) {
      console.error(
        "PDF compression error:",
        error
      );

      res.status(500).json({
        error:
          error.message ||
          "PDF compression failed."
      });

    } finally {
      if (
        localFile &&
        fs.existsSync(localFile)
      ) {
        try {
          fs.unlinkSync(localFile);
        } catch (deleteError) {
          console.error(
            "Could not delete temporary file:",
            deleteError
          );
        }
      }
    }
  }
);

// Error handler
app.use(
  (error, req, res, next) => {
    console.error(error);

    if (
      error.code === "LIMIT_FILE_SIZE"
    ) {
      return res.status(400).json({
        error:
          "File is too large. Maximum size is 50 MB."
      });
    }

    res.status(400).json({
      error:
        error.message ||
        "Something went wrong."
    });
  }
);

// Start server
app.listen(
  PORT,
  HOST,
  () => {
    console.log(
      `File Compressor running on ${HOST}:${PORT}`
    );
  }
);