**Task:** Create a "Code Timeline Playback" component, similar to the one found in Codility or other online coding interview tests.

**Context & Reference Material:**
I am providing an image of a Codility interface (image_0.png). Focus specifically on the bottom right section labeled "Task timeline" and its associated controls at the very bottom of the screen.

**Component Requirements Checklist:**

**1. Layout & Structure (Strict adherence to reference image):**

* The component should be contained within a panel with a header labeled "Task timeline".
* **Code Viewer Area:** Below the header, there must be a scrollable code editor view. It must show line numbers and syntax highlighting (assume Java or JavaScript for now). The height should be fixed relative to the container, and overflow content must scroll vertically.
* **Timeline Controls Container:** At the bottom, separate from the code view, there must be a control bar containing a progress slider and playback buttons.
* **Sizing:** The relative proportions of the code viewer height versus the control bar height should match the reference image.

**2. The Controls (Exact match to reference image):**

* **Timeline Slider:** A horizontal slider bar indicating progress.
* **Timestamps:** Start time on the left of the slider (e.g., "00:00") and total duration/current end time on the right.
* **Buttons:** Below the slider, implement these exact buttons in this order from left to right:
* Jump to Start (|<<)
* Step Backward One Event (<<)
* Play/Pause Toggle (► / ||)
* Step Forward One Event (>>)
* Jump to End (>>|)


* **Speed Control:** On the far right of the button row, a playback speed selector (e.g., 1x, 2x, 4x).

**3. Playback Behavior & Visualization (CRITICAL CUSTOM REQUIREMENT):**

This is the most important part where your implementation must differ from standard diff viewers.

* **Single View State:** Unlike a GitHub pull request, the component must **never** show a split-view side-by-side diff. It must only display the code as it existed at a single specific point in time.
* **Data Input:** Assume the component receives an array of "Snapshots". Each snapshot contains the full text content of the code at that moment and a timestamp.
* **Visualizing Additions (The Green Highlight):** When the playback moves from Snapshot T1 to T2, calculate the diff. Any lines that exist in T2 but did not exist in T1 must be rendered with a light green background highlight to indicate they were just added. As playback continues to T3, the green highlights from the T2 transition should fade, and only new lines introduced in T3 should be green.
* **Handling Deletions (The Toggle):**
* **Default State:** If a line existed in T1 but is gone in T2, it should simply disappear from the view in T2. The remaining code should collapse to fill the space.
* **Toggle State:** Add a UI toggle switch (e.g., in the header near "Task timeline" or near the speed controls) labeled "Show Deleted Lines".
* **When Toggled ON:** If a line was deleted between T1 and T2, instead of disappearing, that line should remain visible in the T2 view, but rendered with a red strikethrough style or a light red background, indicating it was removed at this step.

**Deliverables:**
Please provide the complete component code, necessary CSS, and a dummy dataset (an array of 4-5 code snapshots showing progressive changes) to demonstrate the functionality.