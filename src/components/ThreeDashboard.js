'use client';
import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text, Float, Stars, MeshDistortMaterial, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

function FloatingNode({ position, color, size, label, count, isBackground }) {
    const mesh = useRef();

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        mesh.current.position.y += Math.sin(t + position[0]) * 0.002;
        if (isBackground) {
            mesh.current.rotation.x = t * 0.1;
            mesh.current.rotation.z = t * 0.05;
        }
    });

    return (
        <Float speed={isBackground ? 1 : 2} rotationIntensity={0.5} floatIntensity={0.5}>
            <mesh position={position} ref={mesh}>
                <sphereGeometry args={[size, 32, 32]} />
                <MeshDistortMaterial
                    color={color}
                    speed={isBackground ? 1 : 2}
                    distort={0.3}
                    radius={size}
                    emissive={color}
                    emissiveIntensity={0.5}
                    transparent
                    opacity={isBackground ? 0.4 : 0.8}
                />
                {!isBackground && (
                    <Text
                        position={[0, size + 0.5, 0]}
                        fontSize={0.4}
                        color="white"
                        anchorX="center"
                        anchorY="middle"
                    >
                        {`${label}\n${count}`}
                    </Text>
                )}
            </mesh>
        </Float>
    );
}

function DataCore({ total, isBackground }) {
    const coreRef = useRef();

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        coreRef.current.rotation.y = t * 0.2;
        coreRef.current.scale.setScalar(1 + Math.sin(t * 2) * 0.05);
    });

    return (
        <group ref={coreRef} position={isBackground ? [0, 0, -5] : [0, 0, 0]}>
            <mesh>
                <octahedronGeometry args={[isBackground ? 3 : 2, 0]} />
                <meshStandardMaterial
                    color="#38bdf8"
                    wireframe
                    emissive="#38bdf8"
                    emissiveIntensity={isBackground ? 1 : 2}
                    transparent
                    opacity={isBackground ? 0.3 : 1}
                />
            </mesh>
            <Text
                position={[0, 0, 0]}
                fontSize={isBackground ? 1.2 : 0.8}
                color="white"
                fontWeight="bold"
                transparent
                opacity={isBackground ? 0.5 : 1}
            >
                {total}
            </Text>
            <Text
                position={[0, -0.8, 0]}
                fontSize={isBackground ? 0.4 : 0.3}
                color="#94a3b8"
                transparent
                opacity={isBackground ? 0.5 : 1}
            >
                TOTAL SERIES
            </Text>
        </group>
    );
}

export default function ThreeDashboard({ stats, isBackground = false }) {
    if (!stats) return null;

    const categories = Object.entries(stats.categories || {}).slice(0, 12); // Show more in background
    const colors = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

    const containerStyle = isBackground ? {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1,
        pointerEvents: 'none',
        background: '#020617' // Base background
    } : {
        width: '100%',
        height: '500px',
        background: 'radial-gradient(circle at center, #0f172a 0%, #020617 100%)',
        borderRadius: '16px',
        overflow: 'hidden',
        position: 'relative'
    };

    return (
        <div style={containerStyle}>
            {isBackground && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'radial-gradient(circle at 50% 50%, rgba(15, 23, 42, 0.5) 0%, #020617 100%)',
                    zIndex: 0
                }} />
            )}

            {!isBackground && (
                <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 1, color: '#38bdf8', fontSize: '1.2rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '2px' }}>
                    Live Universe Monitor
                </div>
            )}

            <Canvas shadows style={{ position: 'relative', zIndex: 1 }}>
                <PerspectiveCamera makeDefault position={[0, 0, isBackground ? 20 : 15]} fov={50} />
                <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={isBackground ? 0.2 : 0.5} />

                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} intensity={1} color="#38bdf8" />
                <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} intensity={2} color="#f43f5e" />

                <Stars radius={150} depth={50} count={isBackground ? 10000 : 5000} factor={4} saturation={0} fade speed={1} />

                <DataCore total={stats.total} isBackground={isBackground} />

                {categories.map(([label, count], idx) => {
                    const angle = (idx / categories.length) * Math.PI * 2;
                    const radius = isBackground ? (10 + Math.sin(idx) * 5) : (6 + Math.sin(idx) * 2);
                    const x = Math.cos(angle) * radius;
                    const z = Math.sin(angle) * radius;
                    const y = (Math.random() - 0.5) * (isBackground ? 15 : 4);

                    return (
                        <FloatingNode
                            key={label}
                            position={[x, y, z]}
                            color={colors[idx % colors.length]}
                            size={(isBackground ? 0.4 : 0.6) + (count / stats.total) * (isBackground ? 1 : 2)}
                            label={label}
                            count={count}
                            isBackground={isBackground}
                        />
                    );
                })}
            </Canvas>
        </div>
    );
}
