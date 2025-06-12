
![Alt text](./public/FullZeptaLogo.png)


# Zeptaframe

Zeptaframe is an AI-native video editor that allows you to create precise AI-generated movies with a visual-first approach, minimizing the need for text prompts. It implements the [Go-with-the-flow](https://github.com/Eyeline-Research/Go-with-the-Flow) technique for precise video generation. Try it at CVPR 2025.

This repository only contains the front-end interface. The backend, along with the custom ComfyUI nodes and pipelines, are deployed using ComfyDeploy.

## Overview

Zeptaframe is a open-source web-based platform that enables users to create AI-generated videos through an intuitive visual interface. Unlike traditional video editors or AI video generators that rely heavily on text prompts, Zeptaframe allows you to upload images and directly manipulate objects on a canvas to create animations.

## Key Features

### Visual-First Video Creation

* Upload or generate images and animate any object on the canvas
* Segment objects automatically and instantly using the Segment Anything Model (SAM)
* Define object trajectories visually rather than through text descriptions

### Multi-Workbench Environment

* Create complex videos using multiple workbenches (canvases)
* Seamlessly navigate between workbenches
* Each workbench has it own context and controls

### AI-Powered Generation

* Generate videos from your visual compositions
* Multiple quality modes: Flash, Normal, and Ultra
* Support for various video models

### Rich Editing Tools

* Shape creation and manipulation
* Text editing with font customization
* Image import and filtering
* Drawing tools
* Object animation controls
* Camera movement controls

### The bottom panel displays:

* Generated videos
* Export options
* Video playback controls

## Technical Implementation

### Frontend Framework

* Next.js and React for the UI
* Tailwind CSS for styling
* Fabric.js for canvas manipulation

### Backend Services

* NextAuth.js for authentication
* Drizzle ORM for database operations
* Hono for API routes
* Stripe for payment processing

### AI Components

* Segment Anything Model (SAMv2) for object segmentation
* ComfyDeploy for GPU instances loaded with ComfyUI.
* The back-end is using a finetuned version of SkyreelsV1 with Go-with-the-flow. This allows the model to generate videos of the 
subject traveling as per the users delineation through the interface.


## Notes

This README was generated with Deepwiki from Devin. 

