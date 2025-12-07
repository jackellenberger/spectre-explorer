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

    // Selection state for color editing
    const [selection, setSelection] = useState<{ type: 'stop', index: number } | { type: 'orientation', angle: number } | null>(null);

    // Local state
    const [stops, setStops] = useState<{angle: number, color: string}[]>([]);
    const [orientationColors, setOrientationColors] = useState<Record<number, string>>({});

    // Initialize state when opening or config changes
    useEffect(() => {
        if (!isOpen) return;

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
        setSelection(null);
    }, [mode, config, palette, uniqueAngles, isOpen]);

    // Persist changes
    const save = () => {
        if (mode === 'orientation-gradient') {
            onChange({ ...config, gradientStops: stops });
        } else if (mode === 'orientation') {
            onChange({ ...config, orientationMap: orientationColors });
        }
    };

    // Draw Loop
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
            const sorted = [...stops].sort((a,b) => a.angle - b.angle);
            if (sorted.length > 0) {
                const grad = ctx.createConicGradient(0, cx, cy);
                sorted.forEach(s => {
                    grad.addColorStop(s.angle / 360, s.color);
                });
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, 2 * Math.PI);
                ctx.fill();
            }

            stops.forEach((s, i) => {
                const rad = s.angle * Math.PI / 180;
                const x = cx + Math.cos(rad) * r;
                const y = cy + Math.sin(rad) * r;

                ctx.beginPath();
                ctx.arc(x, y, 8, 0, 2*Math.PI);
                ctx.fillStyle = s.color;
                ctx.strokeStyle = (selection?.type === 'stop' && selection.index === i) ? '#000' : '#fff';
                ctx.lineWidth = 2;
                ctx.fill();
                ctx.stroke();
            });
        }
        else if (mode === 'orientation') {
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, 2*Math.PI);
            ctx.strokeStyle = '#ddd';
            ctx.stroke();

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

                const color = orientationColors[deg] || '#ccc';
                const isSelected = selection?.type === 'orientation' && selection.angle === deg;

                ctx.beginPath();
                ctx.arc(x, y, 8, 0, 2*Math.PI);
                ctx.fillStyle = color;
                ctx.strokeStyle = isSelected ? '#000' : '#fff';
                ctx.lineWidth = 2;
                ctx.fill();
                ctx.stroke();
            });
        }
    }, [mode, stops, orientationColors, uniqueAngles, isOpen, selection]);

    const handlePointerDown = (e: React.PointerEvent) => {
        const rect = canvasRef.current!.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const cx = rect.width/2;
        const cy = rect.height/2;
        const r = Math.min(rect.width, rect.height) / 2 - 20;

        if (mode === 'orientation-gradient') {
            for (let i = 0; i < stops.length; i++) {
                const s = stops[i];
                const rad = s.angle * Math.PI / 180;
                const x = cx + Math.cos(rad) * r;
                const y = cy + Math.sin(rad) * r;
                const dist = Math.hypot(mouseX - x, mouseY - y);
                if (dist < 15) {
                    setDraggingIndex(i);
                    setSelection({ type: 'stop', index: i });
                    canvasRef.current?.setPointerCapture(e.pointerId);
                    return;
                }
            }
        } else if (mode === 'orientation') {
            for (const deg of uniqueAngles) {
                const rad = deg * Math.PI / 180;
                const x = cx + Math.cos(rad) * r;
                const y = cy + Math.sin(rad) * r;
                const dist = Math.hypot(mouseX - x, mouseY - y);
                if (dist < 15) {
                    setSelection({ type: 'orientation', angle: deg });
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

    const applyColor = (color: string) => {
        if (!selection) return;

        if (selection.type === 'stop') {
            setStops(prev => {
                const next = [...prev];
                next[selection.index] = { ...next[selection.index], color };
                return next;
            });
        } else if (selection.type === 'orientation') {
            setOrientationColors(prev => ({
                ...prev,
                [selection.angle]: color
            }));
        }
        // Keep selection active to allow trying multiple colors?
        // Or clear it?
        // User requested "pick from existing theme". Usually implies selection.
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
                />

                <div className="text-xs text-gray-500 text-center">
                    {selection
                        ? 'Select a color below.'
                        : (mode === 'orientation'
                            ? 'Click circle to select.'
                            : 'Drag circles to move. Click to select.')
                    }
                </div>

                {/* Palette Picker */}
                <div className="flex flex-wrap gap-2 justify-center p-2 bg-gray-50 rounded border border-gray-100">
                    {palette.map((c, i) => (
                        <button
                            key={i}
                            onClick={() => applyColor(c)}
                            className="w-6 h-6 rounded-full border border-gray-300 shadow-sm hover:scale-110 transition-transform"
                            style={{ backgroundColor: c }}
                            title={c}
                        />
                    ))}
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
