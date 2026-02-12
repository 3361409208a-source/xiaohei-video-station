'use client';
import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text, Float, Stars, MeshDistortMaterial, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

function FloatingNode({ position, color, size, label, count }) {
    const mesh = useRef();

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        mesh.current.position.y += Math.sin(t + position[0]) * 0.002;
    });

    return (
        <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
            <mesh position={position} ref={mesh}>
                <sphereGeometry args={[size, 32, 32]} />
                <MeshDistortMaterial
                    color={color}
                    speed={2}
                    distort={0.3}
                    radius={size}
                    emissive={color}
                    emissiveIntensity={0.5}
                    transparent
                    opacity={0.8}
                />
                <Text
                    position={[0, size + 0.5, 0]}
                    fontSize={0.4}
                    color="white"
                    anchorX="center"
                    anchorY="middle"
                >
                    {`${label}\n${count}`}
                </Text>
            </mesh>
        </Float>
    );
}

function DataCore({ total }) {
    const coreRef = useRef();

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        coreRef.current.rotation.y = t * 0.2;
        coreRef.current.scale.setScalar(1 + Math.sin(t * 2) * 0.05);
    });

    return (
        <group ref={coreRef}>
            <mesh>
                <octahedronGeometry args={[2, 0]} />
                <meshStandardMaterial color="#38bdf8" wireframe emissive="#38bdf8" emissiveIntensity={2} />
            </mesh>
            <Text
                position={[0, 0, 0]}
                fontSize={0.8}
                color="white"
                fontWeight="bold"
            >
                {total}
            </Text>
            <Text
                position={[0, -0.8, 0]}
                fontSize={0.3}
                color="#94a3b8"
            >
                TOTAL MOVIES
            </Text>
        </group>
    );
}

export default function ThreeDashboard({ stats }) {
    if (!stats) return null;

    const categories = Object.entries(stats.categories || {}).slice(0, 8); // Top categories
    const colors = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

    return (
        <div style={{ width: '100%', height: '500px', background: 'radial-gradient(circle at center, #0f172a 0%, #020617 100%)', borderRadius: '16px', overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 1, color: '#38bdf8', fontSize: '1.2rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '2px' }}>
                Live Universe Monitor
            </div>

            <Canvas shadows>
                <PerspectiveCamera makeDefault position={[0, 0, 15]} fov={50} />
                <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.5} />

                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} intensity={1} color="#38bdf8" />
                <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} intensity={2} color="#f43f5e" />

                <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

                <DataCore total={stats.total} />

                {categories.map(([label, count], idx) => {
                    const angle = (idx / categories.length) * Math.PI * 2;
                    const radius = 6 + Math.sin(idx) * 2;
                    const x = Math.cos(angle) * radius;
                    const z = Math.sin(angle) * radius;
                    const y = (Math.random() - 0.5) * 4;

                    return (
                        <FloatingNode
                            key={label}
                            position={[x, y, z]}
                            color={colors[idx % colors.length]}
                            size={0.6 + (count / stats.total) * 2}
                            label={label}
                            count={count}
                        />
                    );
                })}
            </Canvas>
        </div>
    );
}
