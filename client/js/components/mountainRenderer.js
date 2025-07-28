/**
 * Mountain Renderer Component
 * Simple static wireframe mountain
 */
export default class MountainRenderer {
    constructor(performanceMode = 'high') {
        this.mountain = null;
        this.cameraZ = 0;
        this.gridCache = new Map(); // Cache generated grid points
        this.performanceMode = performanceMode;
    }
    
    generateMountain() {
        this.updateGrid();
    }
    
    updateGrid() {
        const points = [];
        // Reduce grid complexity based on performance
        const gridSize = this.performanceMode === 'medium' ? 32 : 48;
        const viewDistance = this.performanceMode === 'medium' ? 30 : 50;
        
        // Generate grid around camera position
        const startZ = Math.floor(this.cameraZ - viewDistance / 2);
        const endZ = startZ + viewDistance;
        
        for (let z = startZ; z < endZ; z++) {
            for (let x = 0; x < gridSize; x++) {
                const key = `${x},${z}`;
                
                // Check cache first
                if (!this.gridCache.has(key)) {
                    const height = this.generateHeightAt(x, z, gridSize);
                    this.gridCache.set(key, height);
                }
                
                points.push({
                    x: x - gridSize / 2,
                    z: z - this.cameraZ, // Relative to camera
                    height: this.gridCache.get(key)
                });
            }
        }
        
        // Cull old cache entries to prevent memory leak
        if (this.gridCache.size > 10000) { // Limit cache size
            const keysToDelete = [];
            for (const [key] of this.gridCache) {
                const [, z] = key.split(',').map(Number);
                if (z < startZ - 20 || z > endZ + 20) {
                    keysToDelete.push(key);
                }
            }
            keysToDelete.forEach(key => this.gridCache.delete(key));
        }
        
        this.mountain = { points, size: gridSize };
    }
    
    generateHeightAt(x, z, gridSize) {
        const centerX = gridSize / 2;
        const distFromCenterX = Math.abs(x - centerX);
        
        // Generate cohesive mountain structure using world coordinates
        const ridgeNoise = this.noise(x * 0.02, z * 0.05) * 1.5;
        const peakNoise = this.noise(x * 0.06, z * 0.04) * 0.8;
        const detailNoise = this.noise(x * 0.12, z * 0.12) * 0.2;
        const totalNoise = ridgeNoise + peakNoise + detailNoise;
        
        // Valley factor
        let valleyFactor = 1;
        if (distFromCenterX < 12) {
            valleyFactor = Math.pow(distFromCenterX / 12, 2);
        }
        
        // Base height
        const baseHeight = Math.max(0, Math.pow((distFromCenterX - 8) / 16, 2) * 2);
        
        // Combine and return
        const height = (baseHeight + Math.max(0, totalNoise * 0.4)) * valleyFactor;
        return Math.max(0, height);
    }
    
    // Simple Perlin-like noise function
    noise(x, y) {
        // Simple pseudo-random noise based on coordinates
        const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        return (n - Math.floor(n)) * 2 - 1; // Return value between -1 and 1
    }
    
    render(ctx, width, height, time, themeColor, performanceMode = 'high') {
        // Skip mountain rendering on low performance
        if (performanceMode === 'low') {
            return;
        }
        
        // Move camera forward
        this.cameraZ = time * 2;
        
        // Update grid based on camera position
        this.updateGrid();
        
        // Safety check
        if (!this.mountain || !this.mountain.points || this.mountain.points.length === 0) {
            return;
        }
        
        ctx.save();
        ctx.strokeStyle = themeColor;
        ctx.lineWidth = 1;
        ctx.globalAlpha = performanceMode === 'medium' ? 0.2 : 0.4;
        
        // 3D projection parameters
        const perspective = 200;
        const centerX = width / 2;
        const centerY = height * 0.7;
        
        // Project 3D point to 2D screen
        const project = (x, y, z) => {
            const adjustedZ = z + 8; // Move grid away from camera
            if (adjustedZ <= 0.1) return null; // Cull points behind camera
            const scale = perspective / adjustedZ;
            return {
                x: centerX + x * scale * 3,
                y: centerY - z * scale * 3 - y * scale * 8
            };
        };
        
        // Draw terrain grid
        if (!this.mountain || !this.mountain.points) return;
        
        this.mountain.points.forEach((point, i) => {
            if (!point || typeof point.x === 'undefined' || typeof point.z === 'undefined' || typeof point.height === 'undefined') {
                return; // Skip invalid points
            }
            
            const projected = project(point.x, point.height, point.z);
            if (!projected) return;
            
            // Calculate fade based on distance from camera
            const distanceFromCamera = Math.abs(point.z);
            const maxDistance = 20;
            const fadeAlpha = Math.max(0, 1 - (distanceFromCamera / maxDistance));
            
            if (fadeAlpha <= 0) return; // Skip invisible lines
            
            // Set alpha for fading
            ctx.globalAlpha = fadeAlpha * 0.4;
            
            const gridX = i % this.mountain.size;
            const gridZ = Math.floor(i / this.mountain.size);
            
            // Draw horizontal lines (X direction)
            if (gridX < this.mountain.size - 1 && i + 1 < this.mountain.points.length) {
                const rightPoint = this.mountain.points[i + 1];
                if (rightPoint && typeof rightPoint.x !== 'undefined') {
                    const rightProjected = project(rightPoint.x, rightPoint.height, rightPoint.z);
                    if (rightProjected) {
                        ctx.beginPath();
                        ctx.moveTo(projected.x, projected.y);
                        ctx.lineTo(rightProjected.x, rightProjected.y);
                        ctx.stroke();
                    }
                }
            }
            
            // Draw vertical lines (Z direction)
            if (gridZ < this.mountain.size - 1 && i + this.mountain.size < this.mountain.points.length) {
                const backPoint = this.mountain.points[i + this.mountain.size];
                if (backPoint && typeof backPoint.x !== 'undefined') {
                    const backProjected = project(backPoint.x, backPoint.height, backPoint.z);
                    if (backProjected) {
                        ctx.beginPath();
                        ctx.moveTo(projected.x, projected.y);
                        ctx.lineTo(backProjected.x, backProjected.y);
                        ctx.stroke();
                    }
                }
            }
        });
        
        ctx.restore();
    }
}