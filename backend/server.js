const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const CloudConvert = require("cloudconvert");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.CLOUDCONVERT_API_KEY;

if (!API_KEY) {
  console.error(
    "ERROR: CLOUDCONVERT_API_KEY is missing from .env"
  );

  process.exit(1);
}

const cloudConvert = new CloudConvert(API_KEY);

// Temporary upload directory
const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer configuration
const upload = multer({
  dest: uploadDir,

  limits: {
    fileSize: 50 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(
        new Error("Only PDF files are allowed.")
      );
    }

    cb(null, true);
  }
});

// Serve frontend
app.use(
  express.static(
    path.join(__dirname, "..", "frontend")
  )
);


/*
|--------------------------------------------------------------------------
| PDF Compression
|--------------------------------------------------------------------------
*/

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

      /*
       * Profiles:
       *
       * screen-like behavior -> max
       * balanced             -> web
       * print                -> print
       * archive              -> archive
       * scanned PDFs         -> mrc
       */

      const preset =
        req.body.preset || "web";

      const allowedProfiles = [
        "web",
        "print",
        "archive",
        "mrc",
        "max"
      ];

      const profile =
        allowedProfiles.includes(preset)
          ? preset
          : "web";


      /*
       * Create CloudConvert job.
       *
       * import/upload means the file is uploaded
       * directly to CloudConvert.
       */

      const job =
        await cloudConvert.jobs.create({

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


      /*
       * Find the upload task.
       */

      const uploadTask =
        job.tasks.find(
          task =>
            task.name === "upload-pdf"
        );


      if (!uploadTask) {
        throw new Error(
          "CloudConvert upload task was not created."
        );
      }


      /*
       * Upload the local PDF to CloudConvert.
       */

      await cloudConvert.tasks.upload(
        uploadTask,
        fs.createReadStream(localFile),
        req.file.originalname
      );


      /*
       * Wait until CloudConvert finishes.
       */

      const finishedJob =
        await cloudConvert.jobs.wait(
          job.id
        );


      /*
       * Get exported file.
       */

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


      const outputFile =
        exportedFiles[0];


      /*
       * CloudConvert gives us the final
       * file URL and filename.
       */

      const downloadUrl =
        outputFile.url;


      const filename =
        outputFile.filename ||
        `compressed-${req.file.originalname}`;


      /*
       * CloudConvert's task result may contain
       * file size information.
       */

      let compressedSize =
        null;


      const optimizeTask =
        finishedJob.tasks.find(
          task =>
            task.name === "compress-pdf"
        );


      if (
        optimizeTask &&
        optimizeTask.result &&
        optimizeTask.result.files &&
        optimizeTask.result.files[0]
      ) {

        compressedSize =
          optimizeTask.result.files[0].size ||
          null;

      }


      /*
       * Return information to the frontend.
       */

      res.json({

        success: true,

        originalSize,

        compressedSize,

        downloadUrl,

        filename,

        profile

      });

    }

    catch (error) {

      console.error(
        "PDF compression error:",
        error
      );

      res.status(500).json({

        error:
          error.message ||
          "PDF compression failed."

      });

    }

    finally {

      /*
       * Delete the temporary local file.
       */

      if (
        localFile &&
        fs.existsSync(localFile)
      ) {

        try {

          fs.unlinkSync(
            localFile
          );

        }

        catch (deleteError) {

          console.error(
            "Could not delete temporary file:",
            deleteError
          );

        }

      }

    }

  }
);


/*
|--------------------------------------------------------------------------
| Error Handler
|--------------------------------------------------------------------------
*/

app.use(
  (error, req, res, next) => {

    console.error(error);

    if (
      error.code ===
      "LIMIT_FILE_SIZE"
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

app.get("/healthz", (req, res) => {
  res.status(200).json({
    status: "ok"
  });
});
/*
|--------------------------------------------------------------------------
| Server
|--------------------------------------------------------------------------
*/

const HOST = "0.0.0.0";

app.listen(
  PORT,
  HOST,
  () => {
    console.log(
      `File Compressor running on ${HOST}:${PORT}`
    );
  }
);