*** Begin Patch
*** Update File: src/hooks/useRealModeSensors.ts
@@
-  const setVideo = (el: HTMLVideoElement | null) => {
-    videoRef.current = el;
-  };
+  const setVideo = (el: HTMLVideoElement | null) => {
+    videoRef.current = el;
+  };
@@
-    if (!realMode || powerSaving) {
+    if (!realMode || powerSaving) {
@@
-      if (voiceManagerRef.current) {
-        try { voiceManagerRef.current.cancel(); } catch (_) {}
-        try { voiceManagerRef.current.stopRecognition(); } catch (_) {}
-        voiceManagerRef.current = null;
-      }
-      if (bridgeRef.current) bridgeRef.current = null;
+      if (voiceManagerRef.current) {
+        try { voiceManagerRef.current.cancel(); } catch (_) {}
+        try { voiceManagerRef.current.stopRecognition(); } catch (_) {}
+        voiceManagerRef.current = null;
+      }
+      if (bridgeRef.current) bridgeRef.current = null;
@@
-      if (isModelLoaded()) {
+      if (isModelLoaded()) {
         const runDetection = async () => {
           if (cancelled || !videoRef.current || !videoRef.current.videoWidth) {
             detectionRafRef.current = requestAnimationFrame(runDetection);
             return;
           }
           try {
-            const objects = await detectObjects(videoRef.current, 0.5);
+            const objects = await detectObjects(videoRef.current, 0.5);
             if (!cancelled) {
               setDetectedObjects(objects);
+              // pass predictions to the bridge (it will respect its scoreThreshold)
+              try {
+                bridgeRef.current?.handlePredictions(objects || []);
+              } catch (_) {}
               if (objects.length > 0) {
                 const now = Date.now();
                 if (now - lastEventTimeRef.current > 5000) {
                   lastEventTimeRef.current = now;
                   const topObject = objects[0];
                   generateEvent({
                     type: 'OBJECT_DETECTED',
                     metadata: {
                       source: 'tfjs-coco-ssd',
                       confidence: Math.round(topObject.score * 100),
                       objectClass: topObject.class,
                       objectCount: objects.length,
                     },
                   }, null, objects);
                 }
               }
             }
           } catch {
             // noop
           }
           detectionRafRef.current = requestAnimationFrame(runDetection);
         };
         detectionRafRef.current = requestAnimationFrame(runDetection);
       }
*** End Patch
