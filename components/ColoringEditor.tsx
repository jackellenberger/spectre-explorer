import React, { useState, useRef, useEffect } from 'react';
import { ColoringConfig, ColoringMode } from '../types';

interface ColoringEditorProps {
    isOpen: boolean;
    onClose: () => void;
    mode: ColoringMode;
    config: ColoringConfig;
    onChange: (c: ColoringConfig) => void;
    palette: string[];
    uniqueAngles: number[];
}

export const ColoringEditor: React.FC<ColoringEditorProps> = ({
    isOpen, onClose, mode, config, onChange, palette, uniqueAngles
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

    // Initialize/Sync Local State
    const [stops, setStops] = useState<{angle: number, color: string}[]>([]);
    const [orientationColors, setOrientationColors] = useState<Record<number, string>>({});

    useEffect(() => {
        if (mode === 'orientation-gradient') {
            if (config.gradientStops && config.gradientStops.length > 0) {
                setStops(config.gradientStops);
            } else {
                // Default: spread palette
                const N = palette.length;
                const step = 360 / N;
                setStops(palette.map((c, i) => ({ angle: i * step, color: c })));
            }
        } else if (mode === 'orientation') {
            if (config.orientationMap) {
                setOrientationColors(config.orientationMap);
            } else {
                // Default mapping logic
                const map: Record<number, string> = {};
                uniqueAngles.forEach((ang, idx) => {
                    map[ang] = palette[idx % palette.length];
                });
                setOrientationColors(map);
            }
        }
    }, [mode, config, palette, uniqueAngles, isOpen]);

    // Persist changes
    const save = () => {
        if (mode === 'orientation-gradient') {
            onChange({ ...config, gradientStops: stops });
        } else if (mode === 'orientation') {
            onChange({ ...config, orientationMap: orientationColors });
        }
    };

    // Draw
    useEffect(() => {
        const cvs = canvasRef.current;
        if (!cvs) return;
        const ctx = cvs.getContext('2d');
        if (!ctx) return;

        const w = cvs.width;
        const h = cvs.height;
        const cx = w / 2;
        const cy = h / 2;
        const r = Math.min(w, h) / 2 - 20;

        ctx.clearRect(0, 0, w, h);

        if (mode === 'orientation-gradient') {
            // Draw gradient ring
            // We need to construct a conic gradient
            // We need to sort stops
            const sorted = [...stops].sort((a,b) => a.angle - b.angle);
            if (sorted.length > 0) {
                const grad = ctx.createConicGradient(0, cx, cy); // startAngle?
                // Conic gradient accepts 0-1 or angles?
                // CSS conic-gradient uses angles. Canvas createConicGradient(startAngle, x, y).
                // It adds stops at 0..1 (fraction of 2PI).

                // We need to handle wrapping.
                // addColorStop takes (offset, color).
                // We should add stops.

                sorted.forEach(s => {
                    grad.addColorStop(s.angle / 360, s.color);
                });
                // To ensure smooth wrap, add the first color at 1 if not present?
                // Actually conic gradient interpolates last to first automatically?
                // MDN says yes if 0 and 1 are not defined.
                // But we define explicit stops.
                // If sorted[0].angle > 0, the range 0..sorted[0] is filled by last color?
                // No, it extends.
                // We should replicate the interpolation logic.
                // For visualization, adding stops is enough.

                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, 2 * Math.PI);
                ctx.fill();
            }

            // Draw stops handles
            stops.forEach((s, i) => {
                const rad = (s.angle - 90) * Math.PI / 180; // -90 because conic starts at top? No, usually right (0).
                // createConicGradient startAngle 0 is usually 3 o'clock (0 rad).
                // CSS is top (12 o'clock).
                // Let's assume 0 is right.
                const radDisplay = s.angle * Math.PI / 180;

                const x = cx + Math.cos(radDisplay) * r;
                const y = cy + Math.sin(radDisplay) * r;

                ctx.beginPath();
                ctx.arc(x, y, 8, 0, 2*Math.PI);
                ctx.fillStyle = s.color;
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.fill();
                ctx.stroke();
            });
        }
        else if (mode === 'orientation') {
            // Draw circle outline
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, 2*Math.PI);
            ctx.strokeStyle = '#ddd';
            ctx.stroke();

            // Draw lines for unique angles
            uniqueAngles.forEach(deg => {
                const rad = deg * Math.PI / 180;
                const x = cx + Math.cos(rad) * r;
                const y = cy + Math.sin(rad) * r;

                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(x, y);
                ctx.setLineDash([5, 5]);
                ctx.strokeStyle = '#999';
                ctx.stroke();
                ctx.setLineDash([]);

                // Draw circle handle
                ctx.beginPath();
                ctx.arc(x, y, 8, 0, 2*Math.PI);
                ctx.fillStyle = orientationColors[deg] || '#ccc';
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.fill();
                ctx.stroke();
            });
        }
    }, [mode, stops, orientationColors, uniqueAngles]);

    // Interaction
    const handlePointerDown = (e: React.PointerEvent) => {
        const rect = canvasRef.current!.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const cx = rect.width/2;
        const cy = rect.height/2;
        const r = Math.min(rect.width, rect.height) / 2 - 20;

        if (mode === 'orientation-gradient') {
            // Check hit on stops
            for (let i = 0; i < stops.length; i++) {
                const s = stops[i];
                const rad = s.angle * Math.PI / 180;
                const x = cx + Math.cos(rad) * r;
                const y = cy + Math.sin(rad) * r;
                const dist = Math.hypot(mouseX - x, mouseY - y);
                if (dist < 15) {
                    setDraggingIndex(i);
                    canvasRef.current?.setPointerCapture(e.pointerId);
                    return;
                }
            }
        } else if (mode === 'orientation') {
            // Check hit on angle handles
            for (const deg of uniqueAngles) {
                const rad = deg * Math.PI / 180;
                const x = cx + Math.cos(rad) * r;
                const y = cy + Math.sin(rad) * r;
                const dist = Math.hypot(mouseX - x, mouseY - y);
                if (dist < 15) {
                    // Open color picker for this angle
                    // Use a hidden input?
                    const input = document.createElement('input');
                    input.type = 'color';
                    input.value = orientationColors[deg] || '#cccccc';
                    input.onchange = (ev: any) => {
                        setOrientationColors(prev => {
                            const next = { ...prev, [deg]: ev.target.value };
                            // Auto save or wait?
                            return next;
                        });
                    };
                    input.click();
                    return;
                }
            }
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (draggingIndex !== null && mode === 'orientation-gradient') {
            const rect = canvasRef.current!.getBoundingClientRect();
            const cx = rect.width/2;
            const cy = rect.height/2;
            const dx = e.clientX - rect.left - cx;
            const dy = e.clientY - rect.top - cy;
            let ang = Math.atan2(dy, dx) * 180 / Math.PI;
            if (ang < 0) ang += 360;

            setStops(prev => {
                const next = [...prev];
                next[draggingIndex] = { ...next[draggingIndex], angle: ang };
                return next;
            });
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (draggingIndex !== null) {
            setDraggingIndex(null);
            canvasRef.current?.releasePointerCapture(e.pointerId);
        }
    };

    // For gradient color change: double click?
    const handleDoubleClick = (e: React.MouseEvent) => {
        if (mode !== 'orientation-gradient') return;
        const rect = canvasRef.current!.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const cx = rect.width/2;
        const cy = rect.height/2;
        const r = Math.min(rect.width, rect.height) / 2 - 20;

        for (let i = 0; i < stops.length; i++) {
            const s = stops[i];
            const rad = s.angle * Math.PI / 180;
            const x = cx + Math.cos(rad) * r;
            const y = cy + Math.sin(rad) * r;
            const dist = Math.hypot(mouseX - x, mouseY - y);
            if (dist < 15) {
                const input = document.createElement('input');
                input.type = 'color';
                input.value = s.color;
                input.onchange = (ev: any) => {
                    setStops(prev => {
                        const next = [...prev];
                        next[i] = { ...next[i], color: ev.target.value };
                        return next;
                    });
                };
                input.click();
                return;
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-4 rounded-lg shadow-xl w-80 flex flex-col gap-4">
                <h3 className="text-sm font-bold text-gray-700">
                    {mode === 'orientation' ? 'Edit Orientation Colors' : 'Edit Gradient'}
                </h3>

                <canvas
                    ref={canvasRef}
                    width={280}
                    height={280}
                    className="border border-gray-200 rounded self-center cursor-pointer"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onDoubleClick={handleDoubleClick}
                />

                <div className="text-xs text-gray-500 text-center">
                    {mode === 'orientation'
                        ? 'Click circle to change color.'
                        : 'Drag circles to move. Double-click to change color.'}
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2 bg-gray-100 rounded text-xs font-semibold"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => { save(); onClose(); }}
                        className="flex-1 py-2 bg-blue-600 text-white rounded text-xs font-semibold"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};
