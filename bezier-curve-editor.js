//if you're reading this, yea a lot of it is AI generated, mostly to make sure something like this would work, I do plan on cleaning up a lot of this and removing some very stupid implementations
class BezierCurveDemo {
    constructor() {
        this.canvas = document.getElementById('bezierCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.isDragging = false;
        this.dragPoint = null;
        this.isPanning = false;
        this.lastPanPoint = null;
        this.showControlLines = true;
        this.showControlPoints = true;
        this.gridSnap = true;
        
        // Context menu for anchor point operations
        this.selectedAnchor = null;
        this.contextMenuVisible = false;
        this.contextMenuButtons = [];
        
        // Viewport/Camera properties for pan and zoom
        this.camera = {
            x: 0,      // Camera position in world coordinates
            y: 0,
            zoom: 20   // Pixels per grid unit (1 grid unit = 1x1 internal grid)
        };
        
        // Cache for expensive curve calculations
        this.curveCache = {
            isDirty: true,
            stepSize: null,
            allRawLeftPoints: null,
            allRawRightPoints: null,
            occupationGrid: null,
            simplifiedLeftPoints: null,
            simplifiedRightPoints: null,
            fillBricks: null
        };
        
        // Throttle drawing during panning for better performance
        this.drawPending = false;
        
        // Internal grid is always 1x1, but displayed size depends on zoom
        this.internalGridSize = 1;
        this.segmentCount = 1;
        this.curveWidthInGrids = 2;
        this.brickHeight = 1;
        this.showCurveWidth = true;
        this.showGridPoints = false;
        this.showOriginalCurve = true;
        this.showTriangles = true;
        this.showSegmentErrors = false;
        this.showOccupiedCells = false;
        this.showFillBricks = true;
        this.fillBrickColor = { r: 0, g: 255, b: 0 };
        this.wedgeColor = { r: 255, g: 0, b: 0 };
        
        this.resizeCanvas();
        this.initializeDefaultView();
        this.generateBezierSegments();
        this.init();
    }
    
    initializeDefaultView() {
        // Set up a reasonable initial view
        // Center the camera and set up initial curve area
        this.camera.x = 15; // Center around x=15 in world coordinates
        this.camera.y = 10; // Center around y=10 in world coordinates
        this.camera.zoom = 10; // 20 pixels per grid unit
    }
    
    init() {
        this.setupEventListeners();
        
        const initializeLayout = () => {
            this.resizeCanvas();
            this.updateSliderDisplays();
            this.draw();
        };
        
        initializeLayout();
        setTimeout(initializeLayout, 50);
        setTimeout(initializeLayout, 200);
    }
    
    resizeCanvas() {
        const container = this.canvas.parentElement;
        container.offsetHeight; // Force reflow
        
        const rect = container.getBoundingClientRect();
        const minWidth = 400;
        const minHeight = 300;
        const paddingAndBorder = 4;
        const newWidth = Math.max(minWidth, rect.width - paddingAndBorder);
        const newHeight = Math.max(minHeight, rect.height - paddingAndBorder);
        
        if (this.canvas.width !== newWidth || this.canvas.height !== newHeight) {
            this.canvas.width = newWidth;
            this.canvas.height = newHeight;
            this.canvas.style.width = this.canvas.width + 'px';
            this.canvas.style.height = this.canvas.height + 'px';
        }
    }
    
    updateSliderDisplays() {
        document.getElementById('segmentCount').value = this.segmentCount;
        document.getElementById('segmentCountInput').value = this.segmentCount;
        document.getElementById('curveWidth').value = this.curveWidthInGrids;
        document.getElementById('curveWidthInput').value = this.curveWidthInGrids;
        document.getElementById('brickHeight').value = this.brickHeight;
        document.getElementById('brickHeightInput').value = this.brickHeight;
        
        document.getElementById('showControlLines').checked = this.showControlLines;
        document.getElementById('showControlPoints').checked = this.showControlPoints;
        document.getElementById('showCurveWidth').checked = this.showCurveWidth;
        document.getElementById('showGridPoints').checked = this.showGridPoints;
        document.getElementById('showOriginalCurve').checked = this.showOriginalCurve;
        document.getElementById('showTriangles').checked = this.showTriangles;
        document.getElementById('showSegmentErrors').checked = this.showSegmentErrors;
        document.getElementById('showOccupiedCells').checked = this.showOccupiedCells;
        
        this.updateRGBControls('fillBrick', this.fillBrickColor);
        this.updateRGBControls('wedge', this.wedgeColor);
        
        this.updateColorPreview('fillBrickPreview', this.fillBrickColor);
        this.updateColorPreview('wedgePreview', this.wedgeColor);
    }
    
    updateRGBControls(prefix, color) {
        document.getElementById(prefix + 'R').value = color.r;
        document.getElementById(prefix + 'RValue').textContent = color.r;
        document.getElementById(prefix + 'G').value = color.g;
        document.getElementById(prefix + 'GValue').textContent = color.g;
        document.getElementById(prefix + 'B').value = color.b;
        document.getElementById(prefix + 'BValue').textContent = color.b;
    }
    
    updateColorPreview(elementId, color) {
        const preview = document.getElementById(elementId);
        preview.style.backgroundColor = this.getRGBColorString(color);
    }
    
    forceCanvasResize() {
        const container = this.canvas.parentElement;
        const originalDisplay = container.style.display;
        container.style.display = 'none';
        container.offsetHeight; // Force reflow
        container.style.display = originalDisplay;
        
        setTimeout(() => {
            this.resizeCanvas();
            this.draw();
        }, 10);
    }
    
    setupEventListeners() {
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.forceCanvasResize();
            }, 100);
        });
        
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.forceCanvasResize(), 500);
        });
        
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        
        // Prevent default drag behavior that can interfere with custom dragging
        this.canvas.addEventListener('dragstart', (e) => {
            e.preventDefault();
            return false;
        });
        
        // Prevent image dragging and selection
        this.canvas.addEventListener('selectstart', (e) => {
            e.preventDefault();
            return false;
        });
        
        this.canvas.addEventListener('touchstart', this.onTouchStart.bind(this));
        this.canvas.addEventListener('touchmove', this.onTouchMove.bind(this));
        this.canvas.addEventListener('touchend', this.onTouchEnd.bind(this));
        
        document.getElementById('resetBtn').addEventListener('click', this.reset.bind(this));
        document.getElementById('randomizeBtn').addEventListener('click', this.randomize.bind(this));
        document.getElementById('exportBtn').addEventListener('click', this.exportAsBrs.bind(this));
        
        document.getElementById('segmentCount').addEventListener('input', (e) => {
            this.segmentCount = parseInt(e.target.value);
            document.getElementById('segmentCountInput').value = this.segmentCount;
            this.generateBezierSegments();
            this.draw();
        });
        
        document.getElementById('segmentCountInput').addEventListener('input', (e) => {
            this.segmentCount = Math.max(1, Math.min(8, parseInt(e.target.value) || 1));
            document.getElementById('segmentCount').value = this.segmentCount;
            this.generateBezierSegments();
            this.draw();
        });
        
        document.getElementById('showControlLines').addEventListener('change', (e) => {
            this.showControlLines = e.target.checked;
            this.draw();
        });
        
        document.getElementById('showControlPoints').addEventListener('change', (e) => {
            this.showControlPoints = e.target.checked;
            this.draw();
        });
        
        document.getElementById('curveWidth').addEventListener('input', (e) => {
            this.curveWidthInGrids = Math.max(1, parseInt(e.target.value));
            document.getElementById('curveWidthInput').value = this.curveWidthInGrids;
            this.invalidateCurveCache();
            this.draw();
        });
        
        document.getElementById('curveWidthInput').addEventListener('input', (e) => {
            this.curveWidthInGrids = Math.max(1, Math.min(10, parseInt(e.target.value) || 1));
            document.getElementById('curveWidth').value = this.curveWidthInGrids;
            this.invalidateCurveCache();
            this.draw();
        });
        
        document.getElementById('brickHeight').addEventListener('input', (e) => {
            this.brickHeight = Math.max(1, parseInt(e.target.value));
            document.getElementById('brickHeightInput').value = this.brickHeight;
        });
        
        document.getElementById('brickHeightInput').addEventListener('input', (e) => {
            this.brickHeight = Math.max(1, Math.min(50, parseInt(e.target.value) || 1));
            document.getElementById('brickHeight').value = this.brickHeight;
        });
        
        document.getElementById('showCurveWidth').addEventListener('change', (e) => {
            this.showCurveWidth = e.target.checked;
            this.draw();
        });
        
        document.getElementById('showGridPoints').addEventListener('change', (e) => {
            this.showGridPoints = e.target.checked;
            this.draw();
        });
        
        document.getElementById('showOriginalCurve').addEventListener('change', (e) => {
            this.showOriginalCurve = e.target.checked;
            this.draw();
        });
        
        document.getElementById('showTriangles').addEventListener('change', (e) => {
            this.showTriangles = e.target.checked;
            this.draw();
        });
        
        document.getElementById('showSegmentErrors').addEventListener('change', (e) => {
            this.showSegmentErrors = e.target.checked;
            this.draw();
        });
        
        document.getElementById('showOccupiedCells').addEventListener('change', (e) => {
            this.showOccupiedCells = e.target.checked;
            this.draw();
        });
        
        document.getElementById('showFillBricks').addEventListener('change', (e) => {
            this.showFillBricks = e.target.checked;
            this.draw();
        });
        
        const fillBrickRGBControls = ['fillBrickR', 'fillBrickG', 'fillBrickB'];
        fillBrickRGBControls.forEach(controlId => {
            document.getElementById(controlId).addEventListener('input', (e) => {
                const component = controlId.replace('fillBrick', '').toLowerCase();
                this.fillBrickColor[component] = parseInt(e.target.value);
                document.getElementById(controlId + 'Value').textContent = e.target.value;
                this.updateColorPreview('fillBrickPreview', this.fillBrickColor);
                this.draw();
            });
        });
        
        const wedgeRGBControls = ['wedgeR', 'wedgeG', 'wedgeB'];
        wedgeRGBControls.forEach(controlId => {
            document.getElementById(controlId).addEventListener('input', (e) => {
                const component = controlId.replace('wedge', '').toLowerCase();
                this.wedgeColor[component] = parseInt(e.target.value);
                document.getElementById(controlId + 'Value').textContent = e.target.value;
                this.updateColorPreview('wedgePreview', this.wedgeColor);
                this.draw();
            });
        });
        
        // Pan and zoom event listeners
        this.canvas.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
        
        // Add right-click pan support
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }
    
    // Invalidate the curve cache when curve data changes
    invalidateCurveCache() {
        this.curveCache.isDirty = true;
    }
    
    // Throttled draw method for smooth panning
    drawThrottled() {
        if (!this.drawPending) {
            this.drawPending = true;
            requestAnimationFrame(() => {
                this.draw();
                this.drawPending = false;
            });
        }
    }
    
    getRGBColorString(rgbColor) {
        return `rgb(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b})`;
    }
    
    getRGBAColorString(rgbColor, alpha) {
        return `rgba(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b}, ${alpha})`;
    }
    
    generateBezierSegments() {
        this.segments = [];
        
        // Generate segments in a fixed area in world coordinates
        // Use fixed coordinates that don't depend on camera position
        const worldWidth = 80; // Fixed width in world units
        const worldHeight = 80; // Fixed height in world units
        
        // Fixed center point in world coordinates
        const fixedCenterX = 15;
        const fixedCenterY = 10;
        
        const startX = fixedCenterX - worldWidth / 2;
        const endX = fixedCenterX + worldWidth / 2;
        const centerY = fixedCenterY;
        
        const marginX = worldWidth * 0.1;
        const marginY = worldHeight * 0.2;
        const segmentWidth = (worldWidth - 2 * marginX) / this.segmentCount;
        
        for (let i = 0; i < this.segmentCount; i++) {
            const segmentStartX = startX + marginX + (i * segmentWidth);
            const segmentEndX = startX + marginX + ((i + 1) * segmentWidth);
            
            const start = this.snapToGrid({ x: segmentStartX, y: centerY });
            const end = this.snapToGrid({ x: segmentEndX, y: centerY });
            const cp1 = this.snapToGrid({ x: segmentStartX + segmentWidth * 0.25, y: centerY - marginY });
            const cp2 = this.snapToGrid({ x: segmentStartX + segmentWidth * 0.75, y: centerY + marginY });
            
            // Store relative positions of control points for automatic following
            const cp1RelativeToStart = {
                x: cp1.x - start.x,
                y: cp1.y - start.y
            };
            const cp2RelativeToEnd = {
                x: cp2.x - end.x,
                y: cp2.y - end.y
            };
            
            this.segments.push({ 
                start, 
                cp1, 
                cp2, 
                end,
                // Store relative positions for control point following
                cp1RelativeToStart,
                cp2RelativeToEnd
            });
        }
        
        // Ensure segment continuity
        for (let i = 1; i < this.segments.length; i++) {
            this.segments[i].start.x = this.segments[i - 1].end.x;
            this.segments[i].start.y = this.segments[i - 1].end.y;
            // Update cp1 relative position after continuity adjustment
            this.segments[i].cp1RelativeToStart = {
                x: this.segments[i].cp1.x - this.segments[i].start.x,
                y: this.segments[i].cp1.y - this.segments[i].start.y
            };
            // Update cp2 relative position for the previous segment after continuity adjustment
            this.segments[i - 1].cp2RelativeToEnd = {
                x: this.segments[i - 1].cp2.x - this.segments[i - 1].end.x,
                y: this.segments[i - 1].cp2.y - this.segments[i - 1].end.y
            };
        }
        
        // Invalidate cache when segments change
        this.invalidateCurveCache();
    }
    
    snapToGrid(point) {
        if (!this.gridSnap) return point;
        
        return {
            x: Math.round(point.x / this.internalGridSize) * this.internalGridSize,
            y: Math.round(point.y / this.internalGridSize) * this.internalGridSize
        };
    }
    
    calculateBezierPoint(segment, t) {
        const mt = 1 - t;
        const mt2 = mt * mt;
        const mt3 = mt2 * mt;
        const t2 = t * t;
        const t3 = t2 * t;
        
        return {
            x: mt3 * segment.start.x + 3 * mt2 * t * segment.cp1.x + 3 * mt * t2 * segment.cp2.x + t3 * segment.end.x,
            y: mt3 * segment.start.y + 3 * mt2 * t * segment.cp1.y + 3 * mt * t2 * segment.cp2.y + t3 * segment.end.y
        };
    }
    
    calculateBezierTangent(segment, t) {
        const mt = 1 - t;
        const mt2 = mt * mt;
        const t2 = t * t;
        
        const dx = 3 * mt2 * (segment.cp1.x - segment.start.x) + 
                   6 * mt * t * (segment.cp2.x - segment.cp1.x) + 
                   3 * t2 * (segment.end.x - segment.cp2.x);
        const dy = 3 * mt2 * (segment.cp1.y - segment.start.y) + 
                   6 * mt * t * (segment.cp2.y - segment.cp1.y) + 
                   3 * t2 * (segment.end.y - segment.cp2.y);
        
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length > 0) {
            return { x: dx / length, y: dy / length };
        } else {
            const fallbackDx = segment.end.x - segment.start.x;
            const fallbackDy = segment.end.y - segment.start.y;
            const fallbackLength = Math.sqrt(fallbackDx * fallbackDx + fallbackDy * fallbackDy);
            return fallbackLength > 0 ? 
                { x: fallbackDx / fallbackLength, y: fallbackDy / fallbackLength } : 
                { x: 1, y: 0 };
        }
    }
    
    calculatePerpendicularVector(tangent) {
        return { x: -tangent.y, y: tangent.x };
    }
    
    // Coordinate transformation functions
    
    // Convert screen coordinates to world coordinates
    screenToWorld(screenPoint) {
        return {
            x: (screenPoint.x - this.canvas.width / 2) / this.camera.zoom + this.camera.x,
            y: (screenPoint.y - this.canvas.height / 2) / this.camera.zoom + this.camera.y
        };
    }
    
    // Convert world coordinates to screen coordinates
    worldToScreen(worldPoint) {
        return {
            x: (worldPoint.x - this.camera.x) * this.camera.zoom + this.canvas.width / 2,
            y: (worldPoint.y - this.camera.y) * this.camera.zoom + this.canvas.height / 2
        };
    }
    
    // Get the current display size of a grid cell in screen pixels
    getDisplayGridSize() {
        return this.camera.zoom;
    }
    
    // Get the visible world bounds
    getVisibleWorldBounds() {
        const halfWidth = this.canvas.width / (2 * this.camera.zoom);
        const halfHeight = this.canvas.height / (2 * this.camera.zoom);
        return {
            left: this.camera.x - halfWidth,
            right: this.camera.x + halfWidth,
            top: this.camera.y - halfHeight,
            bottom: this.camera.y + halfHeight
        };
    }
    
    // Pan the camera by screen pixel amounts
    panCamera(deltaX, deltaY) {
        this.camera.x -= deltaX / this.camera.zoom;
        this.camera.y -= deltaY / this.camera.zoom;
    }
    
    // Zoom the camera around a screen point
    zoomCamera(factor, screenPoint) {
        const worldPoint = this.screenToWorld(screenPoint);
        this.camera.zoom *= factor;
        
        // Clamp zoom to reasonable bounds
        this.camera.zoom = Math.max(1, Math.min(200, this.camera.zoom));
        
        // Adjust camera position to zoom around the specified point
        const newWorldPoint = this.screenToWorld(screenPoint);
        this.camera.x += worldPoint.x - newWorldPoint.x;
        this.camera.y += worldPoint.y - newWorldPoint.y;
    }
    
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const screenPos = {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
        
        return this.screenToWorld(screenPos);
    }
    
    getScreenMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }
    
    getTouchPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const screenPos = {
            x: (e.touches[0].clientX - rect.left) * scaleX,
            y: (e.touches[0].clientY - rect.top) * scaleY
        };
        
        return this.screenToWorld(screenPos);
    }
    
    getScreenTouchPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        return {
            x: (e.touches[0].clientX - rect.left) * scaleX,
            y: (e.touches[0].clientY - rect.top) * scaleY
        };
    }
    
    findNearestPoint(pos) {
        // Threshold in world coordinates - scale with zoom level
        const threshold = 15 / this.camera.zoom;
        let nearestPoint = null;
        let nearestDistance = Infinity;
        
        for (let i = 0; i < this.segments.length; i++) {
            const segment = this.segments[i];
            
            // Check all points and find the closest one
            const points = [
                { point: segment.start, type: 'start', segmentIndex: i },
                { point: segment.end, type: 'end', segmentIndex: i },
                { point: segment.cp1, type: 'cp1', segmentIndex: i },
                { point: segment.cp2, type: 'cp2', segmentIndex: i }
            ];
            
            points.forEach(({ point, type, segmentIndex }) => {
                const distance = this.distance(pos, point);
                if (distance < threshold && distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestPoint = { 
                        segmentIndex: segmentIndex, 
                        pointType: type, 
                        point: point 
                    };
                }
            });
        }
        
        return nearestPoint;
    }
    
    distance(p1, p2) {
        return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
    }
    
    onMouseDown(e) {
        e.preventDefault(); // Prevent default drag behavior
        
        const pos = this.getMousePos(e);
        const screenPos = this.getScreenMousePos(e);
        
        // Right click or middle click for panning
        if (e.button === 2 || e.button === 1) {
            this.hideContextMenu();
            this.isPanning = true;
            this.lastPanPoint = screenPos;
            this.canvas.style.cursor = 'grabbing';
            return;
        }
        
        // Left click for control point dragging
        if (e.button === 0) {
            // Check if clicking on context menu first
            if (this.handleContextMenuClick(screenPos)) {
                return;
            }
            
            const nearestPoint = this.findNearestPoint(pos);
            
            if (nearestPoint) {
                // Check if this is an anchor point (start or end)
                if (nearestPoint.pointType === 'start' || nearestPoint.pointType === 'end') {
                    // Immediately start dragging and show context menu
                    this.selectedAnchor = nearestPoint;
                    this.showContextMenu(nearestPoint);
                    this.isDragging = true;
                    this.dragPoint = nearestPoint;
                    this.canvas.style.cursor = 'grabbing';
                } else {
                    // Hide context menu and drag control point
                    this.hideContextMenu();
                    this.isDragging = true;
                    this.dragPoint = nearestPoint;
                    this.canvas.style.cursor = 'grabbing';
                }
            } else {
                // Hide context menu and start panning if not clicking on a control point
                this.hideContextMenu();
                this.isPanning = true;
                this.lastPanPoint = screenPos;
                this.canvas.style.cursor = 'grabbing';
            }
        }
    }
    
    onMouseMove(e) {
        e.preventDefault(); // Prevent default behavior during dragging
        
        const pos = this.getMousePos(e);
        const screenPos = this.getScreenMousePos(e);
        
        if (this.isPanning && this.lastPanPoint) {
            // Pan the camera
            const deltaX = screenPos.x - this.lastPanPoint.x;
            const deltaY = screenPos.y - this.lastPanPoint.y;
            this.panCamera(deltaX, deltaY);
            this.lastPanPoint = screenPos;
            
            // Update context menu position if visible
            if (this.contextMenuVisible) {
                this.updateContextMenuPosition();
            }
            
            this.drawThrottled();
        } else if (this.isDragging && this.dragPoint) {
            const snappedPos = this.snapToGrid(pos);
            
            // Store the old position for calculating movement delta
            const oldX = this.dragPoint.point.x;
            const oldY = this.dragPoint.point.y;
            
            this.dragPoint.point.x = snappedPos.x;
            this.dragPoint.point.y = snappedPos.y;
            
            // Update control points to follow their anchor points
            this.updateControlPointPositions(this.dragPoint);
            
            // Update context menu position if dragging a selected anchor
            if (this.selectedAnchor && 
                this.selectedAnchor.segmentIndex === this.dragPoint.segmentIndex && 
                this.selectedAnchor.pointType === this.dragPoint.pointType) {
                this.updateContextMenuPosition();
            }
            
            // Ensure continuity between segments
            this.maintainContinuity();
            
            // Invalidate cache when control points change
            this.invalidateCurveCache();
            this.draw();
        } else {
            // Change cursor when hovering over control points
            const nearestPoint = this.findNearestPoint(pos);
            this.canvas.style.cursor = nearestPoint ? 'grab' : 'crosshair';
        }
    }
    
    onMouseUp(e) {
        this.isDragging = false;
        this.dragPoint = null;
        this.isPanning = false;
        this.lastPanPoint = null;
        this.canvas.style.cursor = 'crosshair';
    }
    
    onWheel(e) {
        e.preventDefault();
        
        const screenPos = this.getScreenMousePos(e);
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        
        this.zoomCamera(zoomFactor, screenPos);
        
        // Update context menu position if visible
        if (this.contextMenuVisible) {
            this.updateContextMenuPosition();
        }
        
        this.draw();
    }
    
    // Touch events
    onTouchStart(e) {
        e.preventDefault();
        const pos = this.getTouchPos(e);
        this.onMouseDown({ clientX: pos.x + this.canvas.getBoundingClientRect().left, clientY: pos.y + this.canvas.getBoundingClientRect().top });
    }
    
    onTouchMove(e) {
        e.preventDefault();
        const pos = this.getTouchPos(e);
        this.onMouseMove({ clientX: pos.x + this.canvas.getBoundingClientRect().left, clientY: pos.y + this.canvas.getBoundingClientRect().top });
    }
    
    onTouchEnd(e) {
        e.preventDefault();
        this.onMouseUp(e);
    }
    
    showContextMenu(anchorPoint) {
        this.selectedAnchor = anchorPoint;
        this.contextMenuVisible = true;
        this.createContextMenuButtons();
        this.updateContextMenuPosition();
        this.draw();
    }
    
    hideContextMenu() {
        this.selectedAnchor = null;
        this.contextMenuVisible = false;
        this.contextMenuButtons = [];
        this.draw();
    }
    
    createContextMenuButtons() {
        this.contextMenuButtons = [
            {
                label: '+',
                tooltip: 'Add segment to left',
                action: () => this.addSegmentLeft(),
                color: '#4CAF50'
            },
            {
                label: 'X',
                tooltip: 'Delete anchor',
                action: () => this.deleteAnchor(),
                color: '#f44336'
            },
            {
                label: '+',
                tooltip: 'Add segment to right',
                action: () => this.addSegmentRight(),
                color: '#4CAF50'
            }
        ];
    }
    
    updateContextMenuPosition() {
        if (!this.selectedAnchor || !this.contextMenuVisible) return;
        
        const anchorScreenPos = this.worldToScreen(this.selectedAnchor.point);
        const tangent = this.getTangentAtAnchor(this.selectedAnchor.segmentIndex, this.selectedAnchor.pointType);
        
        // Calculate perpendicular vector (90 degrees to tangent)
        const perpendicular = { x: -tangent.y, y: tangent.x };
        
        // Scale button radius and distance with zoom level (but clamp to reasonable bounds)
        const baseButtonRadius = 10;
        const baseDistance = 60;
        const zoomScale = Math.max(0.5, Math.min(2.0, this.camera.zoom / 20)); // Scale between 0.5x and 2x
        
        const buttonRadius = baseButtonRadius;
        const distance = baseDistance * zoomScale;
        
        this.contextMenuButtons.forEach((button, index) => {
            button.radius = buttonRadius;
            
            if (index === 0) { // Add left
                button.x = anchorScreenPos.x - tangent.x * distance;
                button.y = anchorScreenPos.y - tangent.y * distance;
            } else if (index === 2) { // Add right
                button.x = anchorScreenPos.x + tangent.x * distance;
                button.y = anchorScreenPos.y + tangent.y * distance;
            } else if (index === 1) { // Delete
                button.x = anchorScreenPos.x - perpendicular.x * distance;
                button.y = anchorScreenPos.y - perpendicular.y * distance;
            }
        });
    }
    
    drawContextMenu() {
        if (!this.contextMenuVisible || !this.selectedAnchor) return;
        
        this.contextMenuButtons.forEach(button => {
            // Draw circular button background
            this.ctx.beginPath();
            this.ctx.arc(button.x, button.y, button.radius, 0, 2 * Math.PI);
            this.ctx.fillStyle = button.color;
            this.ctx.fill();
            
            // Draw button border
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            
            // Draw symbol based on button label
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = Math.max(2, button.radius * 0.15); // Scale line width with button size
            this.ctx.lineCap = 'round';
            
            if (button.label === '+') {
                // Draw plus symbol
                const symbolSize = button.radius * 0.6;
                
                // Horizontal line
                this.ctx.beginPath();
                this.ctx.moveTo(button.x - symbolSize / 2, button.y);
                this.ctx.lineTo(button.x + symbolSize / 2, button.y);
                this.ctx.stroke();
                
                // Vertical line
                this.ctx.beginPath();
                this.ctx.moveTo(button.x, button.y - symbolSize / 2);
                this.ctx.lineTo(button.x, button.y + symbolSize / 2);
                this.ctx.stroke();
            } else if (button.label === 'X') {
                // Draw X symbol
                const symbolSize = button.radius * 0.6;
                
                // First diagonal line
                this.ctx.beginPath();
                this.ctx.moveTo(button.x - symbolSize / 2, button.y - symbolSize / 2);
                this.ctx.lineTo(button.x + symbolSize / 2, button.y + symbolSize / 2);
                this.ctx.stroke();
                
                // Second diagonal line
                this.ctx.beginPath();
                this.ctx.moveTo(button.x + symbolSize / 2, button.y - symbolSize / 2);
                this.ctx.lineTo(button.x - symbolSize / 2, button.y + symbolSize / 2);
                this.ctx.stroke();
            }
        });
    }
    
    handleContextMenuClick(screenPos) {
        if (!this.contextMenuVisible) return false;
        
        for (const button of this.contextMenuButtons) {
            // Calculate distance from click point to button center
            const dx = screenPos.x - button.x;
            const dy = screenPos.y - button.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Check if click is within the circular button
            if (distance <= button.radius) {
                button.action();
                this.hideContextMenu();
                return true;
            }
        }
        return false;
    }
    
    addSegmentLeft() {
        const segmentIndex = this.selectedAnchor.segmentIndex;
        const pointType = this.selectedAnchor.pointType;
        
        if (pointType === 'start') {
            // Split the previous segment (if it exists) at its midpoint
            if (segmentIndex > 0) {
                this.splitSegmentAtMidpoint(segmentIndex - 1);
            } else {
                // If this is the first segment, extend before it
                this.insertSegmentBefore(segmentIndex);
            }
        } else if (pointType === 'end') {
            // Split the current segment at its midpoint
            this.splitSegmentAtMidpoint(segmentIndex);
        }
    }
    
    addSegmentRight() {
        const segmentIndex = this.selectedAnchor.segmentIndex;
        const pointType = this.selectedAnchor.pointType;
        
        if (pointType === 'start') {
            // Split the current segment at its midpoint
            this.splitSegmentAtMidpoint(segmentIndex);
        } else if (pointType === 'end') {
            // Split the next segment (if it exists) at its midpoint
            if (segmentIndex < this.segments.length - 1) {
                this.splitSegmentAtMidpoint(segmentIndex + 1);
            } else {
                // If this is the last segment, extend after it
                this.insertSegmentAfter(segmentIndex);
            }
        }
    }
    
    deleteAnchor() {
        const segmentIndex = this.selectedAnchor.segmentIndex;
        const pointType = this.selectedAnchor.pointType;
        
        // Don't allow deletion if it would leave us with no segments
        if (this.segments.length <= 1) {
            alert('Cannot delete the last segment!');
            return;
        }
        
        if (pointType === 'start' && segmentIndex > 0) {
            // Merge with previous segment
            this.mergeSegments(segmentIndex - 1, segmentIndex);
        } else if (pointType === 'end' && segmentIndex < this.segments.length - 1) {
            // Merge with next segment
            this.mergeSegments(segmentIndex, segmentIndex + 1);
        } else if (pointType === 'start' && segmentIndex === 0) {
            // Remove first segment
            this.segments.splice(0, 1);
            this.segmentCount = this.segments.length;
        } else if (pointType === 'end' && segmentIndex === this.segments.length - 1) {
            // Remove last segment
            this.segments.splice(-1, 1);
            this.segmentCount = this.segments.length;
        }
        
        this.invalidateCurveCache();
        this.updateSliderDisplays();
        this.draw();
    }
    
    maintainContinuity() {
        // Ensure the end point of one segment matches the start point of the next
        for (let i = 0; i < this.segments.length - 1; i++) {
            if (this.dragPoint && this.dragPoint.segmentIndex === i && this.dragPoint.pointType === 'end') {
                this.segments[i + 1].start.x = this.segments[i].end.x;
                this.segments[i + 1].start.y = this.segments[i].end.y;
            } else if (this.dragPoint && this.dragPoint.segmentIndex === i + 1 && this.dragPoint.pointType === 'start') {
                this.segments[i].end.x = this.segments[i + 1].start.x;
                this.segments[i].end.y = this.segments[i + 1].start.y;
            }
        }
    }
    
    getTangentAtAnchor(segmentIndex, pointType) {
        const segment = this.segments[segmentIndex];
        
        if (pointType === 'start') {
            // For start point, calculate tangent from start towards cp1
            const dx = segment.cp1.x - segment.start.x;
            const dy = segment.cp1.y - segment.start.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            
            if (length > 0) {
                return { x: dx / length, y: dy / length };
            } else {
                // Fallback: use direction towards end point
                const fallbackDx = segment.end.x - segment.start.x;
                const fallbackDy = segment.end.y - segment.start.y;
                const fallbackLength = Math.sqrt(fallbackDx * fallbackDx + fallbackDy * fallbackDy);
                return fallbackLength > 0 ? 
                    { x: fallbackDx / fallbackLength, y: fallbackDy / fallbackLength } : 
                    { x: 1, y: 0 };
            }
        } else if (pointType === 'end') {
            // For end point, calculate tangent from cp2 towards end
            const dx = segment.end.x - segment.cp2.x;
            const dy = segment.end.y - segment.cp2.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            
            if (length > 0) {
                return { x: dx / length, y: dy / length };
            } else {
                // Fallback: use direction from start point
                const fallbackDx = segment.end.x - segment.start.x;
                const fallbackDy = segment.end.y - segment.start.y;
                const fallbackLength = Math.sqrt(fallbackDx * fallbackDx + fallbackDy * fallbackDy);
                return fallbackLength > 0 ? 
                    { x: fallbackDx / fallbackLength, y: fallbackDy / fallbackLength } : 
                    { x: 1, y: 0 };
            }
        }
        
        return { x: 1, y: 0 }; // Default fallback
    }
    
    updateControlPointPositions(dragPoint) {
        const segment = this.segments[dragPoint.segmentIndex];
        
        // Update control points based on which anchor point was moved
        if (dragPoint.pointType === 'start') {
            // Update cp1 to maintain its relative position to the start point
            segment.cp1.x = segment.start.x + segment.cp1RelativeToStart.x;
            segment.cp1.y = segment.start.y + segment.cp1RelativeToStart.y;
            
            // If this is not the first segment, also update cp2 of the previous segment
            if (dragPoint.segmentIndex > 0) {
                const prevSegment = this.segments[dragPoint.segmentIndex - 1];
                prevSegment.cp2.x = prevSegment.end.x + prevSegment.cp2RelativeToEnd.x;
                prevSegment.cp2.y = prevSegment.end.y + prevSegment.cp2RelativeToEnd.y;
            }
        } else if (dragPoint.pointType === 'end') {
            // Update cp2 to maintain its relative position to the end point
            segment.cp2.x = segment.end.x + segment.cp2RelativeToEnd.x;
            segment.cp2.y = segment.end.y + segment.cp2RelativeToEnd.y;
            
            // If this is not the last segment, also update cp1 of the next segment
            if (dragPoint.segmentIndex < this.segments.length - 1) {
                const nextSegment = this.segments[dragPoint.segmentIndex + 1];
                nextSegment.cp1.x = nextSegment.start.x + nextSegment.cp1RelativeToStart.x;
                nextSegment.cp1.y = nextSegment.start.y + nextSegment.cp1RelativeToStart.y;
            }
        } else if (dragPoint.pointType === 'cp1') {
            // Update the relative position when cp1 is directly moved
            segment.cp1RelativeToStart = {
                x: segment.cp1.x - segment.start.x,
                y: segment.cp1.y - segment.start.y
            };
        } else if (dragPoint.pointType === 'cp2') {
            // Update the relative position when cp2 is directly moved
            segment.cp2RelativeToEnd = {
                x: segment.cp2.x - segment.end.x,
                y: segment.cp2.y - segment.end.y
            };
        }
    }
    
    splitSegmentAtMidpoint(segmentIndex) {
        const segment = this.segments[segmentIndex];
        
        // Calculate the actual Bezier curve point at t=0.5 (true midpoint)
        const midPoint = this.calculateBezierPoint(segment, 0.5);
        
        // Use De Casteljau's algorithm to split the Bezier curve at t=0.5
        // This gives us the exact control points for both halves
        const { leftSegment, rightSegment } = this.splitBezierCurveAt(segment, 0.5);
        
        // Snap the midpoint to grid
        const snappedMidPoint = this.snapToGrid(midPoint);
        
        // Update the left segment (becomes the original segment)
        segment.cp1 = this.snapToGrid(leftSegment.cp1);
        segment.cp2 = this.snapToGrid(leftSegment.cp2);
        segment.end = snappedMidPoint;
        
        // Calculate relative positions for the left segment
        segment.cp1RelativeToStart = {
            x: segment.cp1.x - segment.start.x,
            y: segment.cp1.y - segment.start.y
        };
        segment.cp2RelativeToEnd = {
            x: segment.cp2.x - segment.end.x,
            y: segment.cp2.y - segment.end.y
        };
        
        // Create the right segment
        const newSegment = {
            start: snappedMidPoint,
            cp1: this.snapToGrid(rightSegment.cp1),
            cp2: this.snapToGrid(rightSegment.cp2),
            end: this.snapToGrid(rightSegment.end),
            cp1RelativeToStart: {
                x: rightSegment.cp1.x - snappedMidPoint.x,
                y: rightSegment.cp1.y - snappedMidPoint.y
            },
            cp2RelativeToEnd: {
                x: rightSegment.cp2.x - rightSegment.end.x,
                y: rightSegment.cp2.y - rightSegment.end.y
            }
        };
        
        // Insert the new segment after the current one
        this.segments.splice(segmentIndex + 1, 0, newSegment);
        this.segmentCount = this.segments.length;
        this.invalidateCurveCache();
        this.updateSliderDisplays();
    }
    
    splitBezierCurveAt(segment, t) {
        // De Casteljau's algorithm to split a cubic Bezier curve at parameter t
        const { start, cp1, cp2, end } = segment;
        
        // First level interpolation
        const q0 = this.lerp(start, cp1, t);
        const q1 = this.lerp(cp1, cp2, t);
        const q2 = this.lerp(cp2, end, t);
        
        // Second level interpolation
        const r0 = this.lerp(q0, q1, t);
        const r1 = this.lerp(q1, q2, t);
        
        // Final interpolation (the split point)
        const splitPoint = this.lerp(r0, r1, t);
        
        // Left segment: start -> splitPoint
        const leftSegment = {
            start: start,
            cp1: q0,
            cp2: r0,
            end: splitPoint
        };
        
        // Right segment: splitPoint -> end
        const rightSegment = {
            start: splitPoint,
            cp1: r1,
            cp2: q2,
            end: end
        };
        
        return { leftSegment, rightSegment };
    }
    
    lerp(p1, p2, t) {
        // Linear interpolation between two points
        return {
            x: p1.x + (p2.x - p1.x) * t,
            y: p1.y + (p2.y - p1.y) * t
        };
    }
    
    insertSegmentBefore(segmentIndex) {
        const currentSegment = this.segments[segmentIndex];
        const prevSegment = segmentIndex > 0 ? this.segments[segmentIndex - 1] : null;
        
        // Calculate midpoint for new segment
        let newStart, newEnd;
        if (prevSegment) {
            // Midpoint between previous segment end and current segment start
            newStart = {
                x: (prevSegment.end.x + currentSegment.start.x) / 2,
                y: (prevSegment.end.y + currentSegment.start.y) / 2
            };
            newEnd = { ...currentSegment.start };
        } else {
            // Extend before the first segment using the tangent direction
            const tangent = this.getTangentAtAnchor(segmentIndex, 'start');
            const extensionLength = 20; // Length of extension in world units
            
            newEnd = { ...currentSegment.start };
            newStart = {
                x: currentSegment.start.x - tangent.x * extensionLength,
                y: currentSegment.start.y - tangent.y * extensionLength
            };
        }
        
        // Create control points for new segment
        const newCP1 = {
            x: newStart.x + (newEnd.x - newStart.x) * 0.25,
            y: newStart.y + (newEnd.y - newStart.y) * 0.25
        };
        const newCP2 = {
            x: newStart.x + (newEnd.x - newStart.x) * 0.75,
            y: newStart.y + (newEnd.y - newStart.y) * 0.75
        };
        
        const newSegment = {
            start: this.snapToGrid(newStart),
            cp1: this.snapToGrid(newCP1),
            cp2: this.snapToGrid(newCP2),
            end: this.snapToGrid(newEnd),
            cp1RelativeToStart: {
                x: newCP1.x - newStart.x,
                y: newCP1.y - newStart.y
            },
            cp2RelativeToEnd: {
                x: newCP2.x - newEnd.x,
                y: newCP2.y - newEnd.y
            }
        };
        
        this.segments.splice(segmentIndex, 0, newSegment);
        this.segmentCount = this.segments.length;
        this.invalidateCurveCache();
        this.updateSliderDisplays();
    }
    
    insertSegmentAfter(segmentIndex) {
        const currentSegment = this.segments[segmentIndex];
        const nextSegment = segmentIndex < this.segments.length - 1 ? this.segments[segmentIndex + 1] : null;
        
        // Calculate midpoint for new segment
        let newStart, newEnd;
        newStart = { ...currentSegment.end };
        if (nextSegment) {
            // Midpoint between current segment end and next segment start
            newEnd = {
                x: (currentSegment.end.x + nextSegment.start.x) / 2,
                y: (currentSegment.end.y + nextSegment.start.y) / 2
            };
        } else {
            // Extend after the last segment using the tangent direction
            const tangent = this.getTangentAtAnchor(segmentIndex, 'end');
            const extensionLength = 20; // Length of extension in world units
            
            newEnd = {
                x: currentSegment.end.x + tangent.x * extensionLength,
                y: currentSegment.end.y + tangent.y * extensionLength
            };
        }
        
        // Create control points for new segment
        const newCP1 = {
            x: newStart.x + (newEnd.x - newStart.x) * 0.25,
            y: newStart.y + (newEnd.y - newStart.y) * 0.25
        };
        const newCP2 = {
            x: newStart.x + (newEnd.x - newStart.x) * 0.75,
            y: newStart.y + (newEnd.y - newStart.y) * 0.75
        };
        
        const newSegment = {
            start: this.snapToGrid(newStart),
            cp1: this.snapToGrid(newCP1),
            cp2: this.snapToGrid(newCP2),
            end: this.snapToGrid(newEnd),
            cp1RelativeToStart: {
                x: newCP1.x - newStart.x,
                y: newCP1.y - newStart.y
            },
            cp2RelativeToEnd: {
                x: newCP2.x - newEnd.x,
                y: newCP2.y - newEnd.y
            }
        };
        
        this.segments.splice(segmentIndex + 1, 0, newSegment);
        this.segmentCount = this.segments.length;
        this.invalidateCurveCache();
        this.updateSliderDisplays();
    }
    
    splitSegmentAt(segmentIndex, splitPoint) {
        const segment = this.segments[segmentIndex];
        
        // Calculate midpoint between start and end
        const midPoint = {
            x: (segment.start.x + segment.end.x) / 2,
            y: (segment.start.y + segment.end.y) / 2
        };
        
        if (splitPoint === 'start') {
            // Create new segment before current, ending at start point
            const newStart = {
                x: segment.start.x - (segment.end.x - segment.start.x) * 0.5,
                y: segment.start.y - (segment.end.y - segment.start.y) * 0.5
            };
            
            const newCP1 = {
                x: newStart.x + (segment.start.x - newStart.x) * 0.25,
                y: newStart.y + (segment.start.y - newStart.y) * 0.25
            };
            const newCP2 = {
                x: newStart.x + (segment.start.x - newStart.x) * 0.75,
                y: newStart.y + (segment.start.y - newStart.y) * 0.75
            };
            
            const newSegment = {
                start: this.snapToGrid(newStart),
                cp1: this.snapToGrid(newCP1),
                cp2: this.snapToGrid(newCP2),
                end: { ...segment.start },
                cp1RelativeToStart: {
                    x: newCP1.x - newStart.x,
                    y: newCP1.y - newStart.y
                },
                cp2RelativeToEnd: {
                    x: newCP2.x - segment.start.x,
                    y: newCP2.y - segment.start.y
                }
            };
            
            this.segments.splice(segmentIndex, 0, newSegment);
        } else {
            // Create new segment after current, starting at end point
            const newEnd = {
                x: segment.end.x + (segment.end.x - segment.start.x) * 0.5,
                y: segment.end.y + (segment.end.y - segment.start.y) * 0.5
            };
            
            const newCP1 = {
                x: segment.end.x + (newEnd.x - segment.end.x) * 0.25,
                y: segment.end.y + (newEnd.y - segment.end.y) * 0.25
            };
            const newCP2 = {
                x: segment.end.x + (newEnd.x - segment.end.x) * 0.75,
                y: segment.end.y + (newEnd.y - segment.end.y) * 0.75
            };
            
            const newSegment = {
                start: { ...segment.end },
                cp1: this.snapToGrid(newCP1),
                cp2: this.snapToGrid(newCP2),
                end: this.snapToGrid(newEnd),
                cp1RelativeToStart: {
                    x: newCP1.x - segment.end.x,
                    y: newCP1.y - segment.end.y
                },
                cp2RelativeToEnd: {
                    x: newCP2.x - newEnd.x,
                    y: newCP2.y - newEnd.y
                }
            };
            
            this.segments.splice(segmentIndex + 1, 0, newSegment);
        }
        
        this.segmentCount = this.segments.length;
        this.invalidateCurveCache();
        this.updateSliderDisplays();
    }
    
    mergeSegments(segment1Index, segment2Index) {
        const seg1 = this.segments[segment1Index];
        const seg2 = this.segments[segment2Index];
        
        // Create merged segment using start of first and end of second
        const mergedSegment = {
            start: { ...seg1.start },
            cp1: { ...seg1.cp1 },
            cp2: { ...seg2.cp2 },
            end: { ...seg2.end },
            cp1RelativeToStart: { ...seg1.cp1RelativeToStart },
            cp2RelativeToEnd: { ...seg2.cp2RelativeToEnd }
        };
        
        // Replace both segments with the merged one
        this.segments.splice(segment1Index, 2, mergedSegment);
        this.segmentCount = this.segments.length;
        this.invalidateCurveCache();
        this.updateSliderDisplays();
    }
    
    drawBezierSegment(segment) {
        // Convert world coordinates to screen coordinates
        const startScreen = this.worldToScreen(segment.start);
        const cp1Screen = this.worldToScreen(segment.cp1);
        const cp2Screen = this.worldToScreen(segment.cp2);
        const endScreen = this.worldToScreen(segment.end);
        
        this.ctx.beginPath();
        this.ctx.moveTo(startScreen.x, startScreen.y);
        this.ctx.bezierCurveTo(
            cp1Screen.x, cp1Screen.y,
            cp2Screen.x, cp2Screen.y,
            endScreen.x, endScreen.y
        );
        this.ctx.strokeStyle = '#e74c3c';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
    }
    
    drawControlLines(segment) {
        if (!this.showControlLines) return;
        
        const startScreen = this.worldToScreen(segment.start);
        const cp1Screen = this.worldToScreen(segment.cp1);
        const cp2Screen = this.worldToScreen(segment.cp2);
        const endScreen = this.worldToScreen(segment.end);
        
        this.ctx.strokeStyle = '#95a5a6';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([5, 5]);
        
        // Line from start to first control point
        this.ctx.beginPath();
        this.ctx.moveTo(startScreen.x, startScreen.y);
        this.ctx.lineTo(cp1Screen.x, cp1Screen.y);
        this.ctx.stroke();
        
        // Line from second control point to end
        this.ctx.beginPath();
        this.ctx.moveTo(cp2Screen.x, cp2Screen.y);
        this.ctx.lineTo(endScreen.x, endScreen.y);
        this.ctx.stroke();
        
        this.ctx.setLineDash([]);
    }
    
    drawControlPoints(segment, segmentIndex) {
        if (!this.showControlPoints) return;
        
        const points = [
            { point: segment.start, color: '#2ecc71', type: 'anchor', pointType: 'start' },
            { point: segment.cp1, color: '#3498db', type: 'control', pointType: 'cp1' },
            { point: segment.cp2, color: '#3498db', type: 'control', pointType: 'cp2' },
            { point: segment.end, color: '#2ecc71', type: 'anchor', pointType: 'end' }
        ];
        
        points.forEach(({ point, color, type, pointType }) => {
            const screenPoint = this.worldToScreen(point);
            
            // Check if this is the selected anchor
            const isSelected = this.selectedAnchor && 
                             this.selectedAnchor.segmentIndex === segmentIndex && 
                             this.selectedAnchor.pointType === pointType &&
                             type === 'anchor';
            
            // Draw the control point circle
            this.ctx.beginPath();
            const radius = type === 'anchor' ? 8 : 6;
            this.ctx.arc(screenPoint.x, screenPoint.y, radius, 0, 2 * Math.PI);
            this.ctx.fillStyle = isSelected ? '#ff6b35' : color; // Orange for selected
            this.ctx.fill();
            this.ctx.strokeStyle = isSelected ? '#ff6b35' : '#fff';
            this.ctx.lineWidth = isSelected ? 3 : 2;
            this.ctx.stroke();
            
            // Draw additional highlight ring for selected anchor
            if (isSelected) {
                this.ctx.beginPath();
                this.ctx.arc(screenPoint.x, screenPoint.y, radius + 4, 0, 2 * Math.PI);
                this.ctx.strokeStyle = '#ff6b35';
                this.ctx.lineWidth = 2;
                this.ctx.setLineDash([3, 3]);
                this.ctx.stroke();
                this.ctx.setLineDash([]);
            }
            
            // Draw grid coordinates
            const gridX = Math.round(point.x / this.internalGridSize);
            const gridY = Math.round(point.y / this.internalGridSize);
            const coordinateText = `(${gridX}, ${gridY})`;
            
            // Set text style
            this.ctx.fillStyle = '#333';
            this.ctx.font = 'bold 12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 3;
            
            // Position text above the point
            const textY = screenPoint.y - (type === 'anchor' ? 15 : 12);
            
            // Draw white outline for text visibility
            this.ctx.strokeText(coordinateText, screenPoint.x, textY);
            // Draw the coordinate text
            this.ctx.fillText(coordinateText, screenPoint.x, textY);
        });
    }
    
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.drawGrid();
        
        if (this.showCurveWidth) {
            this.drawCurveWidth();
        }
        
        this.segments.forEach((segment, index) => {
            this.drawControlLines(segment);
            this.drawBezierSegment(segment);
            this.drawControlPoints(segment, index);
        });
        
        // Draw context menu last so it appears on top
        this.drawContextMenu();
    }
    
    drawGrid() {
        if (!this.gridSnap) return;
        
        this.ctx.strokeStyle = '#e0e0e0';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([]);
        
        const bounds = this.getVisibleWorldBounds();
        const displayGridSize = this.getDisplayGridSize();
        
        // Calculate grid line positions in world coordinates
        const startX = Math.floor(bounds.left / this.internalGridSize) * this.internalGridSize;
        const endX = Math.ceil(bounds.right / this.internalGridSize) * this.internalGridSize;
        const startY = Math.floor(bounds.top / this.internalGridSize) * this.internalGridSize;
        const endY = Math.ceil(bounds.bottom / this.internalGridSize) * this.internalGridSize;
        
        // Draw vertical lines
        for (let x = startX; x <= endX; x += this.internalGridSize) {
            const screenPos = this.worldToScreen({ x, y: 0 });
            this.ctx.beginPath();
            this.ctx.moveTo(screenPos.x, 0);
            this.ctx.lineTo(screenPos.x, this.canvas.height);
            this.ctx.stroke();
        }
        
        // Draw horizontal lines
        for (let y = startY; y <= endY; y += this.internalGridSize) {
            const screenPos = this.worldToScreen({ x: 0, y });
            this.ctx.beginPath();
            this.ctx.moveTo(0, screenPos.y);
            this.ctx.lineTo(this.canvas.width, screenPos.y);
            this.ctx.stroke();
        }
        
        this.ctx.setLineDash([]);
    }
    
    estimateCurveLength() {
        let totalCurveLength = 0;
        this.segments.forEach(segment => {
            const start = segment.start;
            const cp1 = segment.cp1;
            const cp2 = segment.cp2;
            const end = segment.end;
            
            const chordLength = this.distance(start, end);
            const controlLength = this.distance(start, cp1) + this.distance(cp1, cp2) + this.distance(cp2, end);
            const approxLength = (chordLength + controlLength) / 2;
            totalCurveLength += approxLength;
        });
        return totalCurveLength;
    }

    generateCurveParameters() {
        // Use fixed world coordinate calculations instead of display-dependent values
        const fixedTargetSegmentLength = this.internalGridSize / 5; // Fixed segment length in world coordinates
        const totalCurveLength = this.estimateCurveLength();
        const targetStepsPerCurve = Math.max(1, Math.round(totalCurveLength / fixedTargetSegmentLength));
        const stepSize = 1.0 / (targetStepsPerCurve / this.segments.length);
        
        return { targetSegmentLength: fixedTargetSegmentLength, totalCurveLength, targetStepsPerCurve, stepSize };
    }

    generateBoundaryPoints(stepSize) {
        const allRawLeftPoints = [];
        const allRawRightPoints = [];
        
        this.segments.forEach(segment => {
            const tValues = [];
            
            tValues.push(0);
            
            for (let t = stepSize; t < 1; t += stepSize) {
                tValues.push(t);
            }
            
            tValues.push(1);
            
            tValues.forEach(t => {
                const centerPoint = this.calculateBezierPoint(segment, t);
                const tangent = this.calculateBezierTangent(segment, t);
                const perpendicular = this.calculatePerpendicularVector(tangent);
                
                const halfWidth = (this.curveWidthInGrids * this.internalGridSize) / 2;
                const leftPoint = {
                    x: centerPoint.x - perpendicular.x * halfWidth,
                    y: centerPoint.y - perpendicular.y * halfWidth
                };
                const rightPoint = {
                    x: centerPoint.x + perpendicular.x * halfWidth,
                    y: centerPoint.y + perpendicular.y * halfWidth
                };
                
                allRawLeftPoints.push(leftPoint);
                allRawRightPoints.push(rightPoint);
            });
        });
        
        return { allRawLeftPoints, allRawRightPoints };
    }

    // Helper function to draw a path with world coordinates converted to screen coordinates
    drawWorldPath(points, drawOptions = {}) {
        if (points.length === 0) return;
        
        const screenPoints = points.map(p => this.worldToScreen(p));
        
        this.ctx.beginPath();
        this.ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
        for (let i = 1; i < screenPoints.length; i++) {
            this.ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
        }
        
        if (drawOptions.fill) {
            this.ctx.fill();
        }
        if (drawOptions.stroke !== false) {
            this.ctx.stroke();
        }
    }
    
    // Helper function to draw a rectangle in world coordinates
    drawWorldRect(worldX, worldY, worldWidth, worldHeight) {
        const topLeft = this.worldToScreen({ x: worldX, y: worldY });
        const size = this.worldToScreen({ x: worldWidth, y: worldHeight });
        const origin = this.worldToScreen({ x: 0, y: 0 });
        
        const screenWidth = size.x - origin.x;
        const screenHeight = size.y - origin.y;
        
        this.ctx.fillRect(topLeft.x, topLeft.y, screenWidth, screenHeight);
        this.ctx.strokeRect(topLeft.x, topLeft.y, screenWidth, screenHeight);
    }
    
    drawCurveWidth() {
        // Check if we need to recalculate curve data
        if (this.curveCache.isDirty) {
            this.recalculateCurveData();
        }
        
        // Use cached data for drawing
        this.ctx.strokeStyle = 'rgba(52, 152, 219, 0.3)';
        this.ctx.fillStyle = 'rgba(52, 152, 219, 0.1)';
        this.ctx.lineWidth = 2;
        
        const simplifiedLeftPoints = this.curveCache.simplifiedLeftPoints;
        const simplifiedRightPoints = this.curveCache.simplifiedRightPoints;
        const allRawLeftPoints = this.curveCache.allRawLeftPoints;
        const allRawRightPoints = this.curveCache.allRawRightPoints;
        
        // Draw the original smooth curve boundaries for comparison
        if (this.showOriginalCurve) {
            this.drawOriginalCurveBoundaries(allRawLeftPoints, allRawRightPoints);
        }
        
        // Draw boundary outlines only (no fill since triangles and bricks handle the fill)
        if (simplifiedLeftPoints.length > 0 && simplifiedRightPoints.length > 0) {
            // Draw outline with smooth angular segments
            this.ctx.strokeStyle = 'rgba(52, 152, 219, 0.3)';
            this.ctx.lineWidth = 2;
            
            this.drawWorldPath(simplifiedLeftPoints);
            this.drawWorldPath(simplifiedRightPoints);
            
            // Optionally draw grid points as small circles for clarity
            if (this.showGridPoints) {
                this.drawGridPoints(simplifiedLeftPoints, simplifiedRightPoints);
            }
            
            // Draw right triangles for angular segments
            if (this.showTriangles) {
                this.drawSegmentTriangles(simplifiedLeftPoints, simplifiedRightPoints);
            }
            
            // Draw segment error values
            if (this.showSegmentErrors) {
                this.drawSegmentErrors(simplifiedLeftPoints, simplifiedRightPoints, allRawLeftPoints, allRawRightPoints);
            }
            
            // Draw occupied grid cells
            if (this.showOccupiedCells && this.curveCache.occupationGrid) {
                this.drawOccupiedCells(this.curveCache.occupationGrid);
            }
            
            // Draw fill bricks that will fill the gaps
            if (this.showFillBricks && this.curveCache.fillBricks) {
                this.drawFillBricks(simplifiedLeftPoints, simplifiedRightPoints, this.curveCache.occupationGrid);
            }
        }
    }
    
    // Recalculate all expensive curve data and cache it
    recalculateCurveData() {
        const { stepSize } = this.generateCurveParameters();
        const { allRawLeftPoints, allRawRightPoints } = this.generateBoundaryPoints(stepSize);
        
        // Second pass: create smooth angular segments with overlap prevention for the entire curve
        // First, create occupation grid and optimize left boundary
        const occupationGrid = this.createOccupationGrid();
        const simplifiedLeftPoints = this.createSmoothAngularPath(allRawLeftPoints, occupationGrid);
        this.markTriangleOccupation(simplifiedLeftPoints, occupationGrid, 'left');
        
        // Then optimize right boundary avoiding occupied cells
        const simplifiedRightPoints = this.createSmoothAngularPath(allRawRightPoints, occupationGrid);
        this.markTriangleOccupation(simplifiedRightPoints, occupationGrid, 'right');
        
        // Calculate fill bricks
        const fillGrid = this.createFillGrid(simplifiedLeftPoints, simplifiedRightPoints, occupationGrid);
        const fillBricks = this.findOptimalFillBricks(fillGrid);
        
        // Cache all the expensive calculations
        this.curveCache = {
            isDirty: false,
            stepSize: stepSize,
            allRawLeftPoints: allRawLeftPoints,
            allRawRightPoints: allRawRightPoints,
            occupationGrid: occupationGrid,
            simplifiedLeftPoints: simplifiedLeftPoints,
            simplifiedRightPoints: simplifiedRightPoints,
            fillBricks: fillBricks
        };
        
        // Store for other methods that need them
        this.currentOccupationGrid = occupationGrid;
        this.currentFillBricks = fillBricks;
    }
    
    drawOccupiedCells(occupationGrid) {
        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
        this.ctx.lineWidth = 1;
        
        for (let gridX = 0; gridX < occupationGrid.length; gridX++) {
            for (let gridY = 0; gridY < occupationGrid[gridX].length; gridY++) {
                if (occupationGrid[gridX][gridY]) {
                    const worldPos = this.gridIndexToWorld(gridX, gridY, occupationGrid);
                    this.drawWorldRect(worldPos.x, worldPos.y, this.internalGridSize, this.internalGridSize);
                }
            }
        }
    }

    drawFillBricks(leftPoints, rightPoints, occupationGrid) {
        // Use cached fill bricks instead of recalculating
        const fillBricks = this.curveCache.fillBricks;
        
        this.currentFillBricks = fillBricks;
        
        fillBricks.forEach(brick => {
            // Set fill and stroke styles for each brick
            this.ctx.fillStyle = this.getRGBAColorString(this.fillBrickColor, 0.4);
            this.ctx.strokeStyle = this.getRGBAColorString(this.fillBrickColor, 0.8);
            this.ctx.lineWidth = 2;
            
            // Calculate rectangle dimensions from start and end points
            const worldX = brick.startPoint.x;
            const worldY = brick.startPoint.y;
            const worldWidth = brick.endPoint.x - brick.startPoint.x;
            const worldHeight = brick.endPoint.y - brick.startPoint.y;
            
            this.drawWorldRect(worldX, worldY, worldWidth, worldHeight);
        });
    }

    // Create a grid that marks which cells should be filled (inside curve but not occupied by triangles)
    createFillGrid(leftPoints, rightPoints, occupationGrid) {
        const gridWidth = occupationGrid.gridWidth;
        const gridHeight = occupationGrid.gridHeight;
        
        // Initialize fill grid - true means should be filled, false means don't fill
        const fillGrid = [];
        for (let x = 0; x < gridWidth; x++) {
            fillGrid[x] = [];
            for (let y = 0; y < gridHeight; y++) {
                fillGrid[x][y] = false;
            }
        }
        
        // Copy bounds information for consistency
        fillGrid.bounds = occupationGrid.bounds;
        fillGrid.gridWidth = gridWidth;
        fillGrid.gridHeight = gridHeight;
        
        // Find bounding box of the curve to limit our search area
        const boundingBox = this.getCurveBoundingBox(leftPoints, rightPoints);
        const startGridIndex = this.worldToGridIndex(boundingBox.minX, boundingBox.minY, fillGrid);
        const endGridIndex = this.worldToGridIndex(boundingBox.maxX, boundingBox.maxY, fillGrid);
        
        const startGridX = Math.max(0, startGridIndex.gridX);
        const endGridX = Math.min(gridWidth, endGridIndex.gridX + 1);
        const startGridY = Math.max(0, startGridIndex.gridY);
        const endGridY = Math.min(gridHeight, endGridIndex.gridY + 1);
        
        // Use scanline algorithm for much faster filling
        for (let gridY = startGridY; gridY < endGridY; gridY++) {
            const worldY = fillGrid.bounds.top + gridY * this.internalGridSize + this.internalGridSize / 2;
            const intersections = this.findScanlineIntersections(worldY, leftPoints, rightPoints);
            
            // Fill between pairs of intersections
            for (let i = 0; i < intersections.length; i += 2) {
                if (i + 1 < intersections.length) {
                    const startWorldX = intersections[i];
                    const endWorldX = intersections[i + 1];
                    
                    // Convert world coordinates to grid indices with proper bounds checking
                    const startGridXIndex = this.worldToGridIndex(startWorldX, worldY, fillGrid);
                    const endGridXIndex = this.worldToGridIndex(endWorldX, worldY, fillGrid);
                    
                    // Be more inclusive when determining which grid cells to fill
                    const startX = Math.max(0, Math.floor(startGridXIndex.gridX));
                    const endX = Math.min(gridWidth - 1, Math.ceil(endGridXIndex.gridX));
                    
                    for (let gridX = startX; gridX <= endX; gridX++) {
                        // Double-check that this grid cell is actually inside the curve
                        const cellCenterX = fillGrid.bounds.left + gridX * this.internalGridSize + this.internalGridSize / 2;
                        const cellCenterY = worldY;
                        
                        // Only fill if the cell center is between the intersections and not occupied
                        if (cellCenterX >= startWorldX && cellCenterX <= endWorldX) {
                            if (!occupationGrid[gridX] || !occupationGrid[gridX][gridY]) {
                                fillGrid[gridX][gridY] = true;
                            }
                        }
                    }
                }
            }
        }
        
        return fillGrid;
    }
    
    // Get bounding box of the curve polygon for optimization
    getCurveBoundingBox(leftPoints, rightPoints) {
        const allPoints = [...leftPoints, ...rightPoints];
        if (allPoints.length === 0) {
            // Return a reasonable default in world coordinates
            return { minX: 0, maxX: 30, minY: 0, maxY: 20 };
        }
        
        let minX = allPoints[0].x;
        let maxX = allPoints[0].x;
        let minY = allPoints[0].y;
        let maxY = allPoints[0].y;
        
        for (const point of allPoints) {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        }
        
        // Add some padding
        const padding = this.internalGridSize;
        return {
            minX: minX - padding,
            maxX: maxX + padding,
            minY: minY - padding,
            maxY: maxY + padding
        };
    }
    
    // Find where a horizontal scanline intersects the curve polygon
    findScanlineIntersections(y, leftPoints, rightPoints) {
        const intersections = [];
        
        // Create closed polygon from curve boundaries
        const polygon = [...leftPoints];
        for (let i = rightPoints.length - 1; i >= 0; i--) {
            polygon.push(rightPoints[i]);
        }
        
        // Find intersections with polygon edges
        for (let i = 0; i < polygon.length; i++) {
            const p1 = polygon[i];
            const p2 = polygon[(i + 1) % polygon.length];
            
            // Use a small epsilon for floating point comparisons
            const epsilon = 1e-10;
            
            // Check if scanline intersects this edge (avoid horizontal edges)
            const minY = Math.min(p1.y, p2.y);
            const maxY = Math.max(p1.y, p2.y);
            
            if (y > minY + epsilon && y < maxY - epsilon) {
                // Normal case: line properly crosses the edge
                const yDiff = p2.y - p1.y;
                const intersectionX = p1.x + (y - p1.y) * (p2.x - p1.x) / yDiff;
                intersections.push(intersectionX);
            } else if (Math.abs(y - p1.y) <= epsilon || Math.abs(y - p2.y) <= epsilon) {
                // Edge case: scanline passes through a vertex
                // Only count intersection if it's a "proper" crossing
                const prevIdx = (i - 1 + polygon.length) % polygon.length;
                const nextIdx = (i + 2) % polygon.length;
                
                let vertexPoint, adjacentPoint1, adjacentPoint2;
                if (Math.abs(y - p1.y) <= epsilon) {
                    vertexPoint = p1;
                    adjacentPoint1 = polygon[prevIdx];
                    adjacentPoint2 = p2;
                } else {
                    vertexPoint = p2;
                    adjacentPoint1 = p1;
                    adjacentPoint2 = polygon[nextIdx];
                }
                
                // Check if the two adjacent points are on opposite sides of the scanline
                const side1 = adjacentPoint1.y > y;
                const side2 = adjacentPoint2.y > y;
                
                if (side1 !== side2) {
                    intersections.push(vertexPoint.x);
                }
            }
        }
        
        // Sort intersections by x coordinate and remove duplicates
        intersections.sort((a, b) => a - b);
        
        // Remove very close intersections (likely duplicates)
        const filteredIntersections = [];
        for (let i = 0; i < intersections.length; i++) {
            if (i === 0 || Math.abs(intersections[i] - intersections[i-1]) > 1e-8) {
                filteredIntersections.push(intersections[i]);
            }
        }
        
        return filteredIntersections;
    }
    
    // Check if a point is inside a triangle using barycentric coordinates
    pointInTriangle(px, py, triangle) {
        const [p1, p2, p3] = triangle;
        
        const denominator = (p2.y - p3.y) * (p1.x - p3.x) + (p3.x - p2.x) * (p1.y - p3.y);
        if (Math.abs(denominator) < 1e-10) return false; // Degenerate triangle
        
        const a = ((p2.y - p3.y) * (px - p3.x) + (p3.x - p2.x) * (py - p3.y)) / denominator;
        const b = ((p3.y - p1.y) * (px - p3.x) + (p1.x - p3.x) * (py - p3.y)) / denominator;
        const c = 1 - a - b;
        
        return a >= 0 && b >= 0 && c >= 0;
    }

    // Check if a point is inside the curve area (between left and right boundaries)
    isPointInsideCurve(x, y, leftPoints, rightPoints) {
        // Create a closed polygon from the curve boundaries
        const polygon = [];
        
        // Add left boundary points (forward)
        for (let i = 0; i < leftPoints.length; i++) {
            polygon.push(leftPoints[i]);
        }
        
        // Add right boundary points (reverse order to close the polygon)
        for (let i = rightPoints.length - 1; i >= 0; i--) {
            polygon.push(rightPoints[i]);
        }
        
        // Use ray casting algorithm to determine if point is inside polygon
        return this.pointInPolygon(x, y, polygon);
    }
    
    // Ray casting algorithm to check if a point is inside a polygon
    pointInPolygon(x, y, polygon) {
        let inside = false;
        
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x;
            const yi = polygon[i].y;
            const xj = polygon[j].x;
            const yj = polygon[j].y;
            
            if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        
        return inside;
    }

    // Find optimal rectangular bricks to fill the curve area
    findOptimalFillBricks(fillGrid) {
        const gridWidth = fillGrid.length;
        const gridHeight = fillGrid[0].length;
        const fillBricks = [];
        
        // Create a working copy of the fill grid
        const workingGrid = fillGrid.map(row => [...row]);
        
        // Count total cells that need filling for debugging
        let totalCellsToFill = 0;
        for (let x = 0; x < gridWidth; x++) {
            for (let y = 0; y < gridHeight; y++) {
                if (workingGrid[x][y]) {
                    totalCellsToFill++;
                }
            }
        }
        
        // Greedy algorithm: find largest possible rectangles first
        for (let gridX = 0; gridX < gridWidth; gridX++) {
            for (let gridY = 0; gridY < gridHeight; gridY++) {
                if (workingGrid[gridX][gridY]) {
                    // Find the largest rectangle starting at this position
                    const rect = this.findLargestRectangle(workingGrid, gridX, gridY);
                    
                    if (rect.width > 0 && rect.height > 0) {
                        // Convert grid coordinates to world coordinates
                        const startWorld = this.gridIndexToWorld(rect.gridX, rect.gridY, fillGrid);
                        const endWorld = this.gridIndexToWorld(rect.gridX + rect.width, rect.gridY + rect.height, fillGrid);
                        
                        fillBricks.push({
                            startPoint: startWorld,
                            endPoint: endWorld
                        });
                        
                        // Mark the rectangle area as filled in working grid
                        for (let x = rect.gridX; x < rect.gridX + rect.width; x++) {
                            for (let y = rect.gridY; y < rect.gridY + rect.height; y++) {
                                if (x >= 0 && x < gridWidth && y >= 0 && y < gridHeight) {
                                    workingGrid[x][y] = false;
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // Check for any remaining unfilled cells and create 1x1 bricks for them
        for (let gridX = 0; gridX < gridWidth; gridX++) {
            for (let gridY = 0; gridY < gridHeight; gridY++) {
                if (workingGrid[gridX][gridY]) {
                    // Convert grid coordinates to world coordinates
                    const startWorld = this.gridIndexToWorld(gridX, gridY, fillGrid);
                    const endWorld = this.gridIndexToWorld(gridX + 1, gridY + 1, fillGrid);
                    
                    // Create a 1x1 brick for any remaining unfilled cells
                    fillBricks.push({
                        startPoint: startWorld,
                        endPoint: endWorld
                    });
                    workingGrid[gridX][gridY] = false;
                }
            }
        }
        
        return fillBricks;
    }

    // Find the largest rectangle that can fit starting at the given position
    findLargestRectangle(grid, startX, startY) {
        const gridWidth = grid.length;
        const gridHeight = grid[0].length;
        
        let maxArea = 0;
        let bestRect = { gridX: startX, gridY: startY, width: 0, height: 0 };
        
        // First, find the maximum width from this starting position
        let maxWidth = 0;
        for (let x = startX; x < gridWidth && grid[x][startY]; x++) {
            maxWidth++;
        }
        
        if (maxWidth === 0) {
            return bestRect;
        }
        
        // Try different heights and find the max width for each height
        for (let height = 1; startY + height <= gridHeight; height++) {
            // Find the maximum width that can fit at this height
            let currentMaxWidth = maxWidth;
            
            // Check if all cells in the current row are available
            for (let x = startX; x < startX + currentMaxWidth; x++) {
                if (startY + height - 1 >= gridHeight || !grid[x][startY + height - 1]) {
                    currentMaxWidth = x - startX;
                    break;
                }
            }
            
            if (currentMaxWidth === 0) {
                break;
            }
            
            // Update maxWidth for next iteration
            maxWidth = Math.min(maxWidth, currentMaxWidth);
            
            // Try different widths for this height
            for (let width = 1; width <= currentMaxWidth; width++) {
                const area = width * height;
                if (area > maxArea) {
                    maxArea = area;
                    bestRect = { gridX: startX, gridY: startY, width, height };
                }
            }
        }
        
        return bestRect;
    }

    // Helper function to check if segment should have triangle drawn
    shouldDrawTriangle(startPoint, endPoint) {
        const dx = endPoint.x - startPoint.x;
        const dy = endPoint.y - startPoint.y;
        return Math.abs(dx) > 0.1 * this.internalGridSize && Math.abs(dy) > 0.1 * this.internalGridSize;
    }

    // Draw right triangles showing the angular segments' geometric structure
    drawSegmentTriangles(leftPoints, rightPoints) {
        this.ctx.strokeStyle = this.getRGBAColorString(this.wedgeColor, 0.6); // Selected color for triangles
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([2, 2]); // Dotted line
        
        // Draw triangles for both boundaries
        [
            { points: leftPoints, side: 'left' },
            { points: rightPoints, side: 'right' }
        ].forEach(({ points, side }) => {
            for (let i = 0; i < points.length - 1; i++) {
                const startPoint = points[i];
                const endPoint = points[i + 1];
                
                if (this.shouldDrawTriangle(startPoint, endPoint)) {
                    this.drawRightTriangle(startPoint, endPoint, side);
                }
            }
        });
        
        // Reset line dash
        this.ctx.setLineDash([]);
    }
    
    // Draw error values for each angular segment
    drawSegmentErrors(leftPoints, rightPoints, rawLeftPoints, rawRightPoints) {
        // Set text style - larger and more visible
        this.ctx.fillStyle = '#e74c3c'; // Bright red color for error text
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 4;
        
        // Draw error values for both boundaries
        [
            { points: leftPoints, rawPoints: rawLeftPoints, offsetDirection: -1, side: 'left' },
            { points: rightPoints, rawPoints: rawRightPoints, offsetDirection: 1, side: 'right' }
        ].forEach(({ points, rawPoints, offsetDirection, side }) => {
            for (let i = 0; i < points.length - 1; i++) {
                const segmentStart = points[i];
                const segmentEnd = points[i + 1];
                
                if (this.shouldDrawTriangle(segmentStart, segmentEnd)) {
                    // Calculate error for this specific segment
                    // Find the closest raw points to the segment start and end
                    const startIndex = this.findClosestRawPointIndex(segmentStart, rawPoints);
                    const endIndex = this.findClosestRawPointIndex(segmentEnd, rawPoints);
                    const error = this.calculateError(segmentStart, segmentEnd, rawPoints, startIndex, endIndex);
                    
                    // Calculate midpoint in world coordinates
                    const worldMidX = (segmentStart.x + segmentEnd.x) / 2;
                    const worldMidY = (segmentStart.y + segmentEnd.y) / 2;
                    
                    // Calculate segment direction to position text perpendicular to it
                    const segmentDx = segmentEnd.x - segmentStart.x;
                    const segmentDy = segmentEnd.y - segmentStart.y;
                    const segmentLength = Math.sqrt(segmentDx * segmentDx + segmentDy * segmentDy);
                    
                    if (segmentLength > 0) {
                        // Normalize segment direction
                        const normalizedDx = segmentDx / segmentLength;
                        const normalizedDy = segmentDy / segmentLength;
                        
                        // Calculate perpendicular direction (rotated 90 degrees)
                        const perpDx = -normalizedDy * offsetDirection;
                        const perpDy = normalizedDx * offsetDirection;
                        
                        // Position text away from the segment line in world coordinates
                        const offsetDistance = this.internalGridSize * 0.8; // Offset in world units
                        const textWorldX = worldMidX + perpDx * offsetDistance;
                        const textWorldY = worldMidY + perpDy * offsetDistance;
                        
                        // Convert to screen coordinates for text positioning
                        const screenPos = this.worldToScreen({ x: textWorldX, y: textWorldY });
                        
                        // Format error value based on magnitude
                        let errorText;
                        if (error < 0.1) {
                            errorText = `${(error * 100).toFixed(1)}c°`; // Show in centidegrees for very small errors
                        } else if (error < 1) {
                            errorText = `${error.toFixed(2)}°`;
                        } else if (error < 10) {
                            errorText = `${error.toFixed(1)}°`;
                        } else {
                            errorText = `${error.toFixed(0)}°`;
                        }
                        
                        // Draw background rectangle for better visibility
                        const textMetrics = this.ctx.measureText(errorText);
                        const rectWidth = textMetrics.width + 6;
                        const rectHeight = 16;
                        
                        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
                        this.ctx.fillRect(
                            screenPos.x - rectWidth / 2,
                            screenPos.y - rectHeight / 2,
                            rectWidth,
                            rectHeight
                        );
                        
                        // Draw border around background
                        this.ctx.strokeStyle = '#e74c3c';
                        this.ctx.lineWidth = 1;
                        this.ctx.strokeRect(
                            screenPos.x - rectWidth / 2,
                            screenPos.y - rectHeight / 2,
                            rectWidth,
                            rectHeight
                        );
                        
                        // Draw the error text
                        this.ctx.fillStyle = '#e74c3c';
                        this.ctx.fillText(errorText, screenPos.x, screenPos.y);
                    }
                }
            }
        });
    }
    
    // Draw a right triangle for a single segment
    calculateTriangleCorner(startPoint, endPoint, side) {
        const dx = endPoint.x - startPoint.x;
        const dy = endPoint.y - startPoint.y;
        
        const cornerPoint1 = { x: startPoint.x + dx, y: startPoint.y };
        const cornerPoint2 = { x: startPoint.x, y: startPoint.y + dy };
        
        if (side === 'left') {
            if ((dx > 0 && dy > 0) || (dx < 0 && dy < 0)) {
                return cornerPoint2;
            } else {
                return cornerPoint1;
            }
        } else {
            if ((dx > 0 && dy > 0) || (dx < 0 && dy < 0)) {
                return cornerPoint1;
            } else {
                return cornerPoint2;
            }
        }
    }

    drawRightTriangle(startPoint, endPoint, side) {
        const dx = endPoint.x - startPoint.x;
        const dy = endPoint.y - startPoint.y;
        
        if (Math.abs(dx) < this.internalGridSize * 0.1 || Math.abs(dy) < this.internalGridSize * 0.1) {
            return;
        }
        
        const cornerPoint = this.calculateTriangleCorner(startPoint, endPoint, side);
        
        // Convert world coordinates to screen coordinates
        const startScreen = this.worldToScreen(startPoint);
        const cornerScreen = this.worldToScreen(cornerPoint);
        const endScreen = this.worldToScreen(endPoint);
        
        this.ctx.beginPath();
        this.ctx.moveTo(startScreen.x, startScreen.y);
        this.ctx.lineTo(cornerScreen.x, cornerScreen.y);
        this.ctx.lineTo(endScreen.x, endScreen.y);
        this.ctx.closePath();
        
        this.ctx.fillStyle = this.getRGBAColorString(this.wedgeColor, 0.4);
        this.ctx.fill();
        this.ctx.stroke();
        
        const squareSize = this.getDisplayGridSize() * 0.2;
        this.ctx.strokeRect(
            cornerScreen.x - squareSize/2, 
            cornerScreen.y - squareSize/2, 
            squareSize, 
            squareSize
        );
    }

    drawOriginalCurveBoundaries(leftPoints, rightPoints) {
        this.ctx.strokeStyle = 'rgba(231, 76, 60, 0.4)';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([3, 3]);
        
        [leftPoints, rightPoints].forEach(points => {
            if (points.length > 1) {
                this.drawWorldPath(points);
            }
        });
        
        this.ctx.setLineDash([]);
    }
    
    // Create a 2D occupation grid to track which grid cells are occupied by triangles
    createOccupationGrid() {
        // Use fixed world bounds instead of visible bounds to ensure consistency
        // Find the bounding box of all segments to define a stable grid area
        if (this.segments.length === 0) {
            // Fallback to a reasonable default area
            const bounds = {
                left: 0,
                right: 30,
                top: 0,
                bottom: 20
            };
            const gridWidth = Math.ceil((bounds.right - bounds.left) / this.internalGridSize);
            const gridHeight = Math.ceil((bounds.bottom - bounds.top) / this.internalGridSize);
            
            const grid = [];
            for (let x = 0; x < gridWidth; x++) {
                grid[x] = [];
                for (let y = 0; y < gridHeight; y++) {
                    grid[x][y] = false;
                }
            }
            
            grid.bounds = bounds;
            grid.gridWidth = gridWidth;
            grid.gridHeight = gridHeight;
            return grid;
        }
        
        // Calculate fixed bounds based on segment positions with some padding
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        
        this.segments.forEach(segment => {
            const points = [segment.start, segment.end, segment.cp1, segment.cp2];
            points.forEach(point => {
                minX = Math.min(minX, point.x);
                maxX = Math.max(maxX, point.x);
                minY = Math.min(minY, point.y);
                maxY = Math.max(maxY, point.y);
            });
        });
        
        // Add padding for curve width
        const padding = this.curveWidthInGrids * this.internalGridSize + 2 * this.internalGridSize;
        const bounds = {
            left: minX - padding,
            right: maxX + padding,
            top: minY - padding,
            bottom: maxY + padding
        };
        
        const gridWidth = Math.ceil((bounds.right - bounds.left) / this.internalGridSize);
        const gridHeight = Math.ceil((bounds.bottom - bounds.top) / this.internalGridSize);
        
        // Initialize 2D array with false (unoccupied)
        const grid = [];
        for (let x = 0; x < gridWidth; x++) {
            grid[x] = [];
            for (let y = 0; y < gridHeight; y++) {
                grid[x][y] = false;
            }
        }
        
        // Store grid bounds for later use
        grid.bounds = bounds;
        grid.gridWidth = gridWidth;
        grid.gridHeight = gridHeight;
        
        return grid;
    }
    
    // Convert world coordinates to grid indices
    worldToGridIndex(x, y, grid) {
        return {
            gridX: Math.floor((x - grid.bounds.left) / this.internalGridSize),
            gridY: Math.floor((y - grid.bounds.top) / this.internalGridSize)
        };
    }
    
    // Convert grid indices to world coordinates
    gridIndexToWorld(gridX, gridY, grid) {
        return {
            x: grid.bounds.left + gridX * this.internalGridSize,
            y: grid.bounds.top + gridY * this.internalGridSize
        };
    }
    
    // Mark grid cells occupied by rectangles from a boundary path (simplified from triangles)
    markTriangleOccupation(points, occupationGrid, side) {
        for (let i = 0; i < points.length - 1; i++) {
            const startPoint = points[i];
            const endPoint = points[i + 1];
            
            const dx = endPoint.x - startPoint.x;
            const dy = endPoint.y - startPoint.y;
            
            // Only process segments that form meaningful rectangles
            if (Math.abs(dx) > 0.1 * this.internalGridSize && Math.abs(dy) > 0.1 * this.internalGridSize) {
                this.markRectangleGridCells(startPoint, endPoint, occupationGrid);
            }
        }
    }
    
    // Mark all grid cells covered by a rectangle defined by two points
    markRectangleGridCells(startPoint, endPoint, occupationGrid) {
        // Find bounding rectangle of the segment
        const minX = Math.min(startPoint.x, endPoint.x);
        const maxX = Math.max(startPoint.x, endPoint.x);
        const minY = Math.min(startPoint.y, endPoint.y);
        const maxY = Math.max(startPoint.y, endPoint.y);
        
        // Convert to grid coordinates
        const startGrid = this.worldToGridIndex(minX, minY, occupationGrid);
        const endGrid = this.worldToGridIndex(maxX, maxY, occupationGrid);
        
        // Mark all grid cells within the rectangle
        for (let gridX = startGrid.gridX; gridX < endGrid.gridX; gridX++) {
            for (let gridY = startGrid.gridY; gridY < endGrid.gridY; gridY++) {
                // Skip if outside grid bounds
                if (gridX < 0 || gridY < 0 || 
                    gridX >= occupationGrid.length || 
                    gridY >= occupationGrid[0].length) {
                    continue;
                }
                
                occupationGrid[gridX][gridY] = true;
            }
        }
    }
    
    wouldTriangleOverlap(startPoint, endPoint, occupationGrid, side) {
        return this.wouldRectangleOverlap(startPoint, endPoint, occupationGrid);
    }
    
    wouldRectangleOverlap(startPoint, endPoint, occupationGrid) {
        const minX = Math.min(startPoint.x, endPoint.x);
        const maxX = Math.max(startPoint.x, endPoint.x);
        const minY = Math.min(startPoint.y, endPoint.y);
        const maxY = Math.max(startPoint.y, endPoint.y);

        // Convert to grid coordinates
        const startGrid = this.worldToGridIndex(minX, minY, occupationGrid);
        const endGrid = this.worldToGridIndex(maxX, maxY, occupationGrid);

        for (let gridX = startGrid.gridX; gridX < endGrid.gridX; gridX++) {
            for (let gridY = startGrid.gridY; gridY < endGrid.gridY; gridY++) {
                if (gridX < 0 || gridY < 0 || 
                    gridX >= occupationGrid.length || 
                    gridY >= occupationGrid[0].length) {
                    continue;
                }
                
                if (occupationGrid[gridX][gridY]) {
                    return true;
                }
            }
        }
        
        return false;
    }

    getGridNeighbors(centerPoint) {
        return this.getGridNeighborsWithRadius(centerPoint, 1);
    }

    // Get all grid neighbors within a specified radius around a point
    getGridNeighborsWithRadius(centerPoint, radius) {
        const neighbors = [];
        
        // Add the center point itself (only for radius 1)
        if (radius === 1) {
            neighbors.push(centerPoint);
        }
        
        // Add neighboring grid points in expanding squares
        for (let r = 1; r <= radius; r++) {
            const stepSize = this.internalGridSize;
            
            // Create a square of points at distance r from center
            for (let dx = -r * stepSize; dx <= r * stepSize; dx += stepSize) {
                for (let dy = -r * stepSize; dy <= r * stepSize; dy += stepSize) {
                    // Skip points that are not on the perimeter of the current radius
                    if (r > 1 && Math.abs(dx) < r * stepSize && Math.abs(dy) < r * stepSize) {
                        continue;
                    }
                    
                    // Skip the center point for radius > 1 (already added for radius 1)
                    if (dx === 0 && dy === 0 && r > 1) continue;
                    
                    const neighbor = {
                        x: centerPoint.x + dx,
                        y: centerPoint.y + dy
                    };
                    
                    // Only add neighbors that are within canvas bounds
                    if (neighbor.x >= 0 && neighbor.x <= this.canvas.width &&
                        neighbor.y >= 0 && neighbor.y <= this.canvas.height) {
                        neighbors.push(neighbor);
                    }
                }
            }
        }
        
        return neighbors;
    }

    // Check if segment meets distance and constraint requirements
    isValidSegment(point1, point2, minLength, maxWidth) {
        const distance = this.distance(point1, point2);
        if (distance < minLength) return false;
        
        const deltaX = Math.abs(point2.x - point1.x);
        const deltaY = Math.abs(point2.y - point1.y);
        
        // allow one axis to be larger than maxWidth, but not both
        return deltaX <= maxWidth || deltaY <= maxWidth;
    }

    // Create smooth angular path that avoids occupied grid cells
    createSmoothAngularPath(rawPoints, occupationGrid) {
        if (rawPoints.length <= 2) return rawPoints.map(p => this.snapToGrid(p));
        
        const smoothPath = [];
        const startPoint = this.snapToGrid(rawPoints[0]);
        smoothPath.push(startPoint);
        
        let currentIndex = 0;
        const minSegmentLength = this.internalGridSize * 0.8;
        const maxSegmentWidth = this.curveWidthInGrids * this.internalGridSize;
        const endThreshold = this.internalGridSize * 2; // Distance threshold for considering we're close enough to the end
        
        while (currentIndex < rawPoints.length - 1) {
            let bestNextIndex = currentIndex + 1;
            let bestScore = Infinity; // Initialize to high value since we're minimizing error
            let foundValidCandidate = false;
            let bestCandidatePoint = null;
            
            // Check if we're close enough to the end to stop
            const currentPoint = smoothPath[smoothPath.length - 1];
            const endPoint = rawPoints[rawPoints.length - 1];
            const distanceToEnd = this.distance(currentPoint, endPoint);
            
            // If we're very close to the end and have covered most of the curve, stop here
            if (distanceToEnd < endThreshold && currentIndex > rawPoints.length * 0.8) {
                break;
            }
            
            let searchedPoints = new Set();
            // Look ahead to find the best next point, but limit search near the end
            const maxLookAhead = Math.min(currentIndex + 100, rawPoints.length);
            
            for (let lookAhead = currentIndex + 1; lookAhead < maxLookAhead; lookAhead++) {
                const baseSnappedPoint = this.snapToGrid(rawPoints[lookAhead]);
                const pointKey = `${baseSnappedPoint.x},${baseSnappedPoint.y}`;
                
                if (searchedPoints.has(pointKey)) {
                    continue;
                }
                searchedPoints.add(pointKey);

                // Search in grid area around the snapped point for better alternatives
                const candidatePoints = this.getGridNeighbors(baseSnappedPoint);
                
                for (const candidatePoint of candidatePoints) {
                    // Check basic constraints and overlap
                    if (!this.isValidSegment(currentPoint, candidatePoint, minSegmentLength, maxSegmentWidth) ||
                        this.wouldTriangleOverlap(currentPoint, candidatePoint, occupationGrid, 'right')) {
                        continue;
                    }
                    
                    foundValidCandidate = true;
                    
                    // Calculate error (lower is better)
                    let error = this.calculateError(currentPoint, candidatePoint, rawPoints, currentIndex, lookAhead);

                    
                    if (error < bestScore) {
                        bestScore = error;
                        bestNextIndex = lookAhead;
                        bestCandidatePoint = candidatePoint;
                    }
                }
            }
            
            // If no valid candidate found and we're not near the end, try to bridge the gap
            if (!foundValidCandidate && currentIndex < rawPoints.length * 0.7) {
                // Advance by a smaller amount when no candidate is found
                currentIndex = Math.min(currentIndex + 3, rawPoints.length - 1);
            } else if (foundValidCandidate) {
                // Use the best candidate point we found
                if (bestCandidatePoint && this.isValidSegment(currentPoint, bestCandidatePoint, minSegmentLength, maxSegmentWidth)) {
                    smoothPath.push(bestCandidatePoint);
                    currentIndex = bestNextIndex;
                } else {
                    currentIndex = Math.min(currentIndex + 1, rawPoints.length - 1);
                }
            } else {
                // Near the end with no valid candidates - stop to avoid inaccurate points
                break;
            }
        }
        
        return smoothPath;
    }

    calculateError(startPoint, endPoint, rawPoints, startIndex, endIndex) {
        return this.calculateSegmentQuality(startPoint, endPoint, rawPoints, startIndex, endIndex) + 
        2 * this.calculateAngleError(startPoint, endPoint, rawPoints, startIndex, endIndex); // Returns error - lower is better
    }

    // Calculate how well a straight line segment represents the original curve
    calculateSegmentQuality(startPoint, endPoint, rawPoints, startIndex, endIndex) {
        if (startIndex >= endIndex) return 0;
        
        let totalDistance = 0;
        let sampleCount = 0;
        
        // Sample points along the straight line segment
        const segmentLength = this.distance(startPoint, endPoint);
        const numSamples = 5; // Sample every half grid unit
        
        for (let i = 0; i <= numSamples; i++) {
            const t = i / numSamples;
            const linePoint = {
                x: startPoint.x + t * (endPoint.x - startPoint.x),
                y: startPoint.y + t * (endPoint.y - startPoint.y)
            };
            
            // Find the closest point on the original curve to this line point
            let minDistanceToOriginal = Infinity;
            for (let j = startIndex; j <= Math.min(endIndex, rawPoints.length - 1); j++) {
                const originalPoint = rawPoints[j];
                const distance = this.distance(linePoint, originalPoint);
                minDistanceToOriginal = Math.min(minDistanceToOriginal, distance);
            }
            
            totalDistance += minDistanceToOriginal * minDistanceToOriginal;
            sampleCount++;
        }
        
        // Return average distance as a measure of how well the segment represents the curve
        return sampleCount > 0 ? totalDistance / sampleCount : 0;
    }

    calculateAngleError(startPoint, endPoint, rawPoints, startIndex, endIndex) {
        if (startIndex >= endIndex || endIndex >= rawPoints.length) return 0;
        
        const segmentAngle = Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x);
        
        const rawStartPoint = rawPoints[startIndex];
        const rawEndPoint = rawPoints[Math.min(endIndex, rawPoints.length - 1)];
        const rawCurveAngle = Math.atan2(rawEndPoint.y - rawStartPoint.y, rawEndPoint.x - rawStartPoint.x);
        
        let angleDiff = segmentAngle - rawCurveAngle;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        const angleDifference = Math.abs(angleDiff);

        return angleDifference / (Math.PI / 2); 
    }

    // Find the index of the closest point in rawPoints to the given point
    findClosestRawPointIndex(targetPoint, rawPoints) {
        if (rawPoints.length === 0) return 0;
        
        let closestIndex = 0;
        let minDistance = this.distance(targetPoint, rawPoints[0]);
        
        for (let i = 1; i < rawPoints.length; i++) {
            const distance = this.distance(targetPoint, rawPoints[i]);
            if (distance < minDistance) {
                minDistance = distance;
                closestIndex = i;
            }
        }
        
        return closestIndex;
    }

    drawGridPoints(leftPoints, rightPoints) {
        this.ctx.fillStyle = 'rgba(52, 152, 219, 0.8)';
        const radius = 3;
        
        // Draw points on both boundaries
        [...leftPoints, ...rightPoints].forEach(point => {
            const screenPoint = this.worldToScreen(point);
            this.ctx.beginPath();
            this.ctx.arc(screenPoint.x, screenPoint.y, radius, 0, 2 * Math.PI);
            this.ctx.fill();
        });
    }
    
    reset() {
        this.generateBezierSegments();
        this.draw();
    }
    
    randomize() {
        const bounds = this.getVisibleWorldBounds();
        const margin = 2; // margin in world coordinates
        const minX = bounds.left + margin;
        const maxX = bounds.right - margin;
        const minY = bounds.top + margin;
        const maxY = bounds.bottom - margin;
        
        this.segments.forEach(segment => {
            const cp1 = this.snapToGrid({
                x: minX + Math.random() * (maxX - minX),
                y: minY + Math.random() * (maxY - minY)
            });
            const cp2 = this.snapToGrid({
                x: minX + Math.random() * (maxX - minX),
                y: minY + Math.random() * (maxY - minY)
            });
            
            segment.cp1 = cp1;
            segment.cp2 = cp2;
            
            // Update relative positions after randomization
            segment.cp1RelativeToStart = {
                x: segment.cp1.x - segment.start.x,
                y: segment.cp1.y - segment.start.y
            };
            segment.cp2RelativeToEnd = {
                x: segment.cp2.x - segment.end.x,
                y: segment.cp2.y - segment.end.y
            };
        });
        
        // Invalidate cache when segments change
        this.invalidateCurveCache();
        this.draw();
    }
    
    // Export the current curve as a Brickadia save file
    createBrickadiaColorPalette() {
        return [
            [this.fillBrickColor.r, this.fillBrickColor.g, this.fillBrickColor.b, 255], // Fill brick color
            [this.wedgeColor.r, this.wedgeColor.g, this.wedgeColor.b, 255], // Wedge color
        ];
    }
    
    createBrickadiaTimestamp() {
        const now = Date.now();
        const save_time = new Array(8).fill(0);
        for (let i = 0; i < 8; i++) {
            save_time[i] = (now >> (i * 8)) & 0xFF;
        }
        return save_time;
    }
    
    createBrickadiaBaseStructure(bricks, description) {
        return {
            version: 10,
            map: 'Plate',
            author: {
                id: '12345678-1234-5678-9abc-123456789abc',
                name: 'Curve Generator'
            },
            description: description,
            save_time: this.createBrickadiaTimestamp(),
            brick_count: bricks.length,
            mods: [],
            brick_assets: [
                'PB_DefaultMicroBrick',
                'PB_DefaultMicroWedge'
            ],
            colors: this.createBrickadiaColorPalette(),
            physical_materials: [],
            materials: ['BMC_Plastic'],
            brick_owners: [{
                id: '12345678-1234-5678-9abc-123456789abc',
                name: 'Curve Generator',
                bricks: bricks.length
            }],
            components: {},
            bricks: bricks
        };
    }

    exportAsBrs() {
        try {
            // Get the angular segments that match what's shown on screen
            const curveSegments = this.getAllCurveSegments();
            
            if (curveSegments.leftPoints.length === 0 || curveSegments.rightPoints.length === 0) {
                alert('No curve segments to export!');
                return;
            }
            
            // Create the save object using the angular segments
            const save = this.createBrickadaSaveFromSegments(curveSegments);
            
            // Convert to binary format using brs-js
            const saveBuffer = BRS.write(save);
            
            // Download as file
            this.downloadFile(saveBuffer, 'curve.brs');
            
            console.log(`Exported curve with ${save.bricks.length} bricks`);
            
        } catch (error) {
            console.error('Error exporting save file:', error);
            alert('Error exporting save file: ' + error.message);
        }
    }
    
    // Get all curve segments using the same angular approximation as the visual representation
    getAllCurveSegments() {
        // Ensure cache is up to date
        if (this.curveCache.isDirty) {
            this.recalculateCurveData();
        }
        
        return {
            leftPoints: this.curveCache.simplifiedLeftPoints,
            rightPoints: this.curveCache.simplifiedRightPoints
        };
    }

    // Create a Brickadia save object from curve segments (using same logic as triangle drawing)
    createBrickadaSaveFromSegments(curveSegments) {

        const bricks = [];
        
        const { leftPoints, rightPoints } = curveSegments;
        
        [
            { points: leftPoints, side: 'left' },
            { points: rightPoints, side: 'right' }
        ].forEach(({ points, side }) => {
            for (let i = 0; i < points.length - 1; i++) {
                const startPoint = points[i];
                const endPoint = points[i + 1];
                
                if (this.shouldDrawTriangle(startPoint, endPoint)) {
                    const segmentBricks = this.createBricksForTriangleSegment(
                        startPoint, endPoint, side
                    );
                    bricks.push(...segmentBricks);
                }
            }
        });
        
        if (this.currentFillBricks && this.currentFillBricks.length > 0) {
            const fillBricks = this.createBricksFromFillRectangles(this.currentFillBricks);
            bricks.push(...fillBricks);
        }
        
        return this.createBrickadiaBaseStructure(bricks, `Bezier curve with ${bricks.length} microbricks (cubes and wedges). Generated from curve editor.`);
    }

    // Create bricks for a triangle segment using the same logic as drawRightTriangle
    createBricksForTriangleSegment(startPoint, endPoint, side) {
        const dx = endPoint.x - startPoint.x;
        const dy = endPoint.y - startPoint.y;
        const bricks = [];
        
        if (Math.abs(dx) < 0.1 || Math.abs(dy) < 0.1) {
            return bricks;
        }

        const triangleWidth = Math.abs(dx);
        const triangleHeight = Math.abs(dy);
        
        const centerPointX = (startPoint.x + endPoint.x);
        const centerPointY = (startPoint.y + endPoint.y);
        
        const wedgeOrientation = this.getWedgeRotationFromTriangleCorner(dx, dy, side);
        
        const wedgeWidth = Math.max(1, Math.round(triangleWidth));
        const wedgeHeight = Math.max(1, Math.round(triangleHeight));
        bricks.push({
            asset_name_index: 1,
            size: [wedgeWidth, wedgeHeight, this.brickHeight],
            position: [centerPointX, centerPointY, (this.brickHeight - 1) * 2 + 1],
            direction: wedgeOrientation.direction,
            rotation: wedgeOrientation.rotation,
            collision: true,
            visibility: true,
            material_index: 0,
            material_intensity: 5,
            physical_index: 0,
            color: 1, // Use wedge color index
            owner_index: 1
        });
        
        return bricks;
    }

    // Create bricks from fill rectangles
    createBricksFromFillRectangles(fillBricks) {
        const bricks = [];
        
        fillBricks.forEach(fillBrick => {
            // Calculate dimensions from start and end points
            const centerPointX = (fillBrick.startPoint.x + fillBrick.endPoint.x);
            const centerPointY = (fillBrick.startPoint.y + fillBrick.endPoint.y);
            
            const width = Math.abs(fillBrick.endPoint.x - fillBrick.startPoint.x);
            const height = Math.abs(fillBrick.endPoint.y - fillBrick.startPoint.y);

            bricks.push({
                asset_name_index: 0, // Use regular microbrick for fill
                size: [width, height, this.brickHeight],
                position: [centerPointX, centerPointY, (this.brickHeight - 1) * 2 + 1],
                direction: 4, // Upward direction
                rotation: 0,
                collision: true,
                visibility: true,
                material_index: 0,
                material_intensity: 5,
                physical_index: 0,
                color: 0, // Use fill brick color index
                owner_index: 1
            });
        });
        
        return bricks;
    }

    // Get wedge rotation and direction based on triangle corner direction
    getWedgeRotationFromTriangleCorner(dx, dy, side) {
        // Normalize directions to determine which neighbors would be present
        const ndx = Math.sign(dx);
        const ndy = Math.sign(dy);
        
        // Account for Y-axis flip in Brickadia coordinates
        const flippedNdy = -ndy;
        
        // Based on the wedge sphere example, wedge rotations are:
        // 0 = West + North neighbors (0b1100)
        // 1 = North + East neighbors (0b0110)  
        // 2 = South + East neighbors (0b0011)
        // 3 = West + South neighbors (0b1001)
        
        // Direction values:
        // 4 = +Z (up), 5 = -Z (down)
        // 0 = +X, 1 = -X, 2 = +Y, 3 = -Y
        
        // For our triangle segments, we need to determine which "corner" configuration this represents
        // The triangle's right angle corner determines the wedge orientation
        
        if (side === 'left') {
            // Left side triangles - wedge should fill the inner corner
            if (ndx > 0 && ndy > 0) {
                // Moving right and down (canvas) = right and up (Brickadia) - South + East corner
                return { rotation: 2, direction: 5 };
            } else if (ndx > 0 && ndy < 0) {
                // Moving right and up (canvas) = right and down (Brickadia) - North + East corner
                return { rotation: 2, direction: 4 };
            } else if (ndx < 0 && ndy > 0) {
                // Moving left and down (canvas) = left and up (Brickadia) - West + South corner
                return { rotation: 0, direction: 4 };
            } else if (ndx < 0 && ndy < 0) {
                // Moving left and up (canvas) = left and down (Brickadia) - West + North corner
                return { rotation: 0, direction: 5 };
            }
        } else {
            // Right side triangles - wedge should fill the inner corner (opposite from left)
            if (ndx > 0 && ndy > 0) {
                // Moving right and down (canvas) = right and up (Brickadia) - West + North corner (opposite of left side)
                return { rotation: 0, direction: 5 }; // Use downward direction for variety
            } else if (ndx > 0 && ndy < 0) {
                // Moving right and up (canvas) = right and down (Brickadia) - West + South corner
                return { rotation: 0, direction: 4 };
            } else if (ndx < 0 && ndy > 0) {
                // Moving left and down (canvas) = left and up (Brickadia) - North + East corner
                return { rotation: 2, direction: 4 };
            } else if (ndx < 0 && ndy < 0) {
                // Moving left and up (canvas) = left and down (Brickadia) - South + East corner
                return { rotation: 2, direction: 5 };
            }
        }
        
        return { rotation: 0, direction: 4 }; // Default rotation and direction
    }
    // Get wedge rotation and direction based on direction changes (adapted from triangle corner logic)
    getWedgeRotationForDirections(dx1, dy1, dx2, dy2) {
        // Normalize directions to -1, 0, or 1 for pattern matching
        const ndx1 = Math.sign(dx1);
        const ndy1 = Math.sign(dy1);
        const ndx2 = Math.sign(dx2);
        const ndy2 = Math.sign(dy2);
        
        // Account for Y-axis flip in Brickadia coordinates
        const flippedNdy1 = -ndy1;
        const flippedNdy2 = -ndy2;

        // Coming from west, going south
        if ((ndx1 === 1 && ndy1 >= 0 && ndx2 <= 0 && ndy2 === 1) ||
            (ndx1 >= 0 && ndy1 === -1 && ndx2 === -1 && ndy2 <= 0)) {
            return { rotation: 2, direction: 4 };
        }
        
        // Coming from north, going west
        if ((ndx1 <= 0 && ndy1 === 1 && ndx2 === -1 && ndy2 <= 0) ||
            (ndx1 === 1 && ndy1 >= 0 && ndx2 <= 0 && ndy2 === -1)) {
            return { rotation: 0, direction: 4 };
        }
        
        // Coming from east, going north
        if ((ndx1 === -1 && ndy1 <= 0 && ndx2 >= 0 && ndy2 === -1) ||
            (ndx1 <= 0 && ndy1 === 1 && ndx2 === 1 && ndy2 >= 0)) {
            return { rotation: 3, direction: 4 };
        }
        
        // Coming from south, going east
        if ((ndx1 >= 0 && ndy1 === -1 && ndx2 === 1 && ndy2 >= 0) ||
            (ndx1 === -1 && ndy1 <= 0 && ndx2 >= 0 && ndy2 === 1)) {
            return { rotation: 1, direction: 4 };
        }
        
        // Default rotation and direction for ambiguous cases
        return { rotation: 0, direction: 4 };
    }
    
    // file Download
    downloadFile(buffer, filename) {
        const blob = new Blob([buffer], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Initialize the demo when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Add a small delay to ensure layout is settled
    setTimeout(() => {
        new BezierCurveDemo();
    }, 10);
});