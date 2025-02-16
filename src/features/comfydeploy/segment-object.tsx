

//     try {
//     const response = await fetch("/api/segment-image", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({ imageUrl, coordinates: clickedPoints }),
//     })

//     const data = await response.json()
//     console.log(data)

//     if (data.runId) {
//       setRunId(data.runId)
//       console.log("Segmentation started. Please wait...")
//     } else {
//       throw new Error("No runId received")
//     }
//   } catch (error) {
//     console.error("Error:", error)
//     setIsSegmenting(false)
//   }