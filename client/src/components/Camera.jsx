import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

/** Webcam preview. Parent gets the <video> element through the ref. */
const Camera = forwardRef(function Camera({ onReady, mirror = false, children }, ref) {
  const videoRef = useRef(null);
  const [error, setError] = useState('');

  useImperativeHandle(ref, () => videoRef.current, []);

  useEffect(() => {
    let stream;
    let cancelled = false;
    (async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setError('Camera needs HTTPS. Open the https:// link of the app, or use “Upload photo” instead.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: false,
        });
        if (cancelled) return;
        const v = videoRef.current;
        v.srcObject = stream;
        await v.play();
        onReady?.(v);
      } catch (e) {
        setError(`Could not open the camera: ${e.message}. You can use “Upload photo” instead.`);
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <div className="notice warn">{error}</div>;
  return (
    <div className="media-frame">
      <video ref={videoRef} playsInline muted className={mirror ? 'mirror' : ''} />
      {children}
    </div>
  );
});

export default Camera;
