//if you're reading this, yea a lot of it is AI generated, mostly to make sure something like this would work, I do plan on cleaning up a lot of this and removing some very stupid implementations
class BezierCurveDemo {
    constructor() {
        this.canvas = document.getElementById('bezierCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.isDragging = false;
        this.dragPoint = null;
        this.showControlLines = true;
        this.showControlPoints = true;
        this.gridSnap = true;
        this.gridSize = 20;
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
        this.generateBezierSegments();
        this.init();
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
        document.getElementById('gridSize').value = this.gridSize;
        document.getElementById('gridSizeInput').value = this.gridSize;
        
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
            this.generateBezierSegments();
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
        
        document.getElementById('gridSize').addEventListener('input', (e) => {
            this.gridSize = parseInt(e.target.value);
            document.getElementById('gridSizeInput').value = this.gridSize;
            this.draw();
        });
        
        document.getElementById('gridSizeInput').addEventListener('input', (e) => {
            this.gridSize = Math.max(1, parseInt(e.target.value) || 1);
            document.getElementById('gridSize').value = this.gridSize;
            this.draw();
        });
        
        document.getElementById('curveWidth').addEventListener('input', (e) => {
            this.curveWidthInGrids = Math.max(1, parseInt(e.target.value));
            document.getElementById('curveWidthInput').value = this.curveWidthInGrids;
            this.draw();
        });
        
        document.getElementById('curveWidthInput').addEventListener('input', (e) => {
            this.curveWidthInGrids = Math.max(1, Math.min(10, parseInt(e.target.value) || 1));
            document.getElementById('curveWidth').value = this.curveWidthInGrids;
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
    }
    
    getRGBColorString(rgbColor) {
        return `rgb(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b})`;
    }
    
    getRGBAColorString(rgbColor, alpha) {
        return `rgba(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b}, ${alpha})`;
    }
    
    generateBezierSegments() {
        this.segments = [];
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        
        const marginX = Math.max(50, canvasWidth * 0.08);
        const marginY = Math.max(50, canvasHeight * 0.1);
        const segmentWidth = (canvasWidth - 2 * marginX) / this.segmentCount;
        
        for (let i = 0; i < this.segmentCount; i++) {
            const startX = marginX + (i * segmentWidth);
            const endX = marginX + ((i + 1) * segmentWidth);
            const centerY = canvasHeight / 2;
            
            const start = this.snapToGrid({ x: startX, y: centerY });
            const end = this.snapToGrid({ x: endX, y: centerY });
            const cp1 = this.snapToGrid({ x: startX + segmentWidth * 0.25, y: centerY - marginY });
            const cp2 = this.snapToGrid({ x: startX + segmentWidth * 0.75, y: centerY + marginY });
            
            this.segments.push({ start, cp1, cp2, end });
        }
        
        // Ensure segment continuity
        for (let i = 1; i < this.segments.length; i++) {
            this.segments[i].start.x = this.segments[i - 1].end.x;
            this.segments[i].start.y = this.segments[i - 1].end.y;
        }
    }
    
    snapToGrid(point) {
        if (!this.gridSnap) return point;
        
        return {
            x: Math.round(point.x / this.gridSize) * this.gridSize,
            y: Math.round(point.y / this.gridSize) * this.gridSize
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
    
    getMousePos(e) {
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
        
        return {
            x: (e.touches[0].clientX - rect.left) * scaleX,
            y: (e.touches[0].clientY - rect.top) * scaleY
        };
    }
    
    findNearestPoint(pos) {
        const threshold = 15;
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
        const pos = this.getMousePos(e);
        const nearestPoint = this.findNearestPoint(pos);
        
        if (nearestPoint) {
            this.isDragging = true;
            this.dragPoint = nearestPoint;
            this.canvas.style.cursor = 'grabbing';
        }
    }
    
    onMouseMove(e) {
        const pos = this.getMousePos(e);
        
        if (this.isDragging && this.dragPoint) {
            const snappedPos = this.snapToGrid(pos);
            this.dragPoint.point.x = snappedPos.x;
            this.dragPoint.point.y = snappedPos.y;
            
            // Ensure continuity between segments
            this.maintainContinuity();
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
        this.canvas.style.cursor = 'crosshair';
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
    
    drawBezierSegment(segment) {
        this.ctx.beginPath();
        this.ctx.moveTo(segment.start.x, segment.start.y);
        this.ctx.bezierCurveTo(
            segment.cp1.x, segment.cp1.y,
            segment.cp2.x, segment.cp2.y,
            segment.end.x, segment.end.y
        );
        this.ctx.strokeStyle = '#e74c3c';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
    }
    
    drawControlLines(segment) {
        if (!this.showControlLines) return;
        
        this.ctx.strokeStyle = '#95a5a6';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([5, 5]);
        
        // Line from start to first control point
        this.ctx.beginPath();
        this.ctx.moveTo(segment.start.x, segment.start.y);
        this.ctx.lineTo(segment.cp1.x, segment.cp1.y);
        this.ctx.stroke();
        
        // Line from second control point to end
        this.ctx.beginPath();
        this.ctx.moveTo(segment.cp2.x, segment.cp2.y);
        this.ctx.lineTo(segment.end.x, segment.end.y);
        this.ctx.stroke();
        
        this.ctx.setLineDash([]);
    }
    
    drawControlPoints(segment) {
        if (!this.showControlPoints) return;
        
        const points = [
            { point: segment.start, color: '#2ecc71', type: 'anchor' },
            { point: segment.cp1, color: '#3498db', type: 'control' },
            { point: segment.cp2, color: '#3498db', type: 'control' },
            { point: segment.end, color: '#2ecc71', type: 'anchor' }
        ];
        
        points.forEach(({ point, color, type }) => {
            // Draw the control point circle
            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, type === 'anchor' ? 8 : 6, 0, 2 * Math.PI);
            this.ctx.fillStyle = color;
            this.ctx.fill();
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            
            // Draw grid coordinates
            const gridX = Math.round(point.x / this.gridSize);
            const gridY = Math.round(point.y / this.gridSize);
            const coordinateText = `(${gridX}, ${gridY})`;
            
            // Set text style
            this.ctx.fillStyle = '#333';
            this.ctx.font = 'bold 12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 3;
            
            // Position text above the point
            const textY = point.y - (type === 'anchor' ? 15 : 12);
            
            // Draw white outline for text visibility
            this.ctx.strokeText(coordinateText, point.x, textY);
            // Draw the coordinate text
            this.ctx.fillText(coordinateText, point.x, textY);
        });
    }
    
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.drawGrid();
        
        if (this.showCurveWidth) {
            this.drawCurveWidth();
        }
        
        this.segments.forEach(segment => {
            this.drawControlLines(segment);
            this.drawBezierSegment(segment);
            this.drawControlPoints(segment);
        });
    }
    
    drawGrid() {
        if (!this.gridSnap) return;
        
        this.ctx.strokeStyle = '#e0e0e0';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([2, 2]);
        
        // Draw vertical lines
        for (let x = 0; x <= this.canvas.width; x += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        // Draw horizontal lines
        for (let y = 0; y <= this.canvas.height; y += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
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
        const targetSegmentLength = this.gridSize / 5;
        const totalCurveLength = this.estimateCurveLength();
        const targetStepsPerCurve = Math.max(1, Math.round(totalCurveLength / targetSegmentLength));
        const stepSize = 1.0 / (targetStepsPerCurve / this.segments.length);
        
        return { targetSegmentLength, totalCurveLength, targetStepsPerCurve, stepSize };
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
                
                const halfWidth = (this.curveWidthInGrids * this.gridSize) / 2;
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

    drawCurveWidth() {
        this.ctx.strokeStyle = 'rgba(52, 152, 219, 0.3)';
        this.ctx.fillStyle = 'rgba(52, 152, 219, 0.1)';
        this.ctx.lineWidth = 2;
        
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
        
        // Store occupation grid for visualization
        this.currentOccupationGrid = occupationGrid;
        
        // Draw the original smooth curve boundaries for comparison
        if (this.showOriginalCurve) {
            this.drawOriginalCurveBoundaries(allRawLeftPoints, allRawRightPoints);
        }
        
        // Draw boundary outlines only (no fill since triangles and bricks handle the fill)
        if (simplifiedLeftPoints.length > 0 && simplifiedRightPoints.length > 0) {
            // Draw outline with smooth angular segments
            this.ctx.strokeStyle = 'rgba(52, 152, 219, 0.3)';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(simplifiedLeftPoints[0].x, simplifiedLeftPoints[0].y);
            for (let i = 1; i < simplifiedLeftPoints.length; i++) {
                this.ctx.lineTo(simplifiedLeftPoints[i].x, simplifiedLeftPoints[i].y);
            }
            this.ctx.stroke();
            
            this.ctx.beginPath();
            this.ctx.moveTo(simplifiedRightPoints[0].x, simplifiedRightPoints[0].y);
            for (let i = 1; i < simplifiedRightPoints.length; i++) {
                this.ctx.lineTo(simplifiedRightPoints[i].x, simplifiedRightPoints[i].y);
            }
            this.ctx.stroke();
            
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
            if (this.showOccupiedCells && this.currentOccupationGrid) {
                this.drawOccupiedCells(this.currentOccupationGrid);
            }
            
            // Draw fill bricks that will fill the gaps
            if (this.showFillBricks && this.currentOccupationGrid) {
                this.drawFillBricks(simplifiedLeftPoints, simplifiedRightPoints, this.currentOccupationGrid);
            }
        }
    }
    
    drawOccupiedCells(occupationGrid) {
        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
        this.ctx.lineWidth = 1;
        
        for (let gridX = 0; gridX < occupationGrid.length; gridX++) {
            for (let gridY = 0; gridY < occupationGrid[gridX].length; gridY++) {
                if (occupationGrid[gridX][gridY]) {
                    const canvasX = gridX * this.gridSize;
                    const canvasY = gridY * this.gridSize;
                    
                    this.ctx.fillRect(canvasX, canvasY, this.gridSize, this.gridSize);
                    this.ctx.strokeRect(canvasX, canvasY, this.gridSize, this.gridSize);
                }
            }
        }
    }

    drawFillBricks(leftPoints, rightPoints, occupationGrid) {
        const fillGrid = this.createFillGrid(leftPoints, rightPoints, occupationGrid);
        const fillBricks = this.findOptimalFillBricks(fillGrid);
        
        this.currentFillBricks = fillBricks;
        
        this.ctx.fillStyle = this.getRGBAColorString(this.fillBrickColor, 0.4);
        this.ctx.strokeStyle = this.getRGBAColorString(this.fillBrickColor, 0.8);
        this.ctx.lineWidth = 2;
        
        fillBricks.forEach(brick => {
            const x = brick.gridX * this.gridSize;
            const y = brick.gridY * this.gridSize;
            const width = brick.width * this.gridSize;
            const height = brick.height * this.gridSize;
            
            this.ctx.fillRect(x, y, width, height);
            this.ctx.strokeRect(x, y, width, height);

            this.ctx.fillStyle = this.getRGBAColorString(this.fillBrickColor, 0.4);
        });
    }

    // Create a grid that marks which cells should be filled (inside curve but not occupied by triangles)
    createFillGrid(leftPoints, rightPoints, occupationGrid) {
        const gridWidth = Math.ceil(this.canvas.width / this.gridSize);
        const gridHeight = Math.ceil(this.canvas.height / this.gridSize);
        
        // Initialize fill grid - true means should be filled, false means don't fill
        const fillGrid = [];
        for (let x = 0; x < gridWidth; x++) {
            fillGrid[x] = [];
            for (let y = 0; y < gridHeight; y++) {
                fillGrid[x][y] = false;
            }
        }
        
        // Find bounding box of the curve to limit our search area
        const boundingBox = this.getCurveBoundingBox(leftPoints, rightPoints);
        const startGridX = Math.max(0, Math.floor(boundingBox.minX / this.gridSize));
        const endGridX = Math.min(gridWidth, Math.ceil(boundingBox.maxX / this.gridSize));
        const startGridY = Math.max(0, Math.floor(boundingBox.minY / this.gridSize));
        const endGridY = Math.min(gridHeight, Math.ceil(boundingBox.maxY / this.gridSize));
        
        // Use scanline algorithm for much faster filling
        for (let gridY = startGridY; gridY < endGridY; gridY++) {
            const scanlineY = gridY * this.gridSize + this.gridSize / 2;
            const intersections = this.findScanlineIntersections(scanlineY, leftPoints, rightPoints);
            
            // Fill between pairs of intersections
            for (let i = 0; i < intersections.length; i += 2) {
                if (i + 1 < intersections.length) {
                    // Fix precision issues for small grid sizes
                    let startX, endX;
                    if (this.gridSize === 1) {
                        // For grid size 1, use more precise calculations
                        startX = Math.max(startGridX, Math.floor(intersections[i] + 0.0001));
                        endX = Math.min(endGridX, Math.floor(intersections[i + 1] - 0.0001) + 1);
                    } else {
                        startX = Math.max(startGridX, Math.floor(intersections[i] / this.gridSize));
                        endX = Math.min(endGridX, Math.ceil(intersections[i + 1] / this.gridSize));
                    }
                    
                    for (let gridX = startX; gridX < endX; gridX++) {
                        // Only fill if not occupied by triangular wedges
                        if (!occupationGrid[gridX] || !occupationGrid[gridX][gridY]) {
                            fillGrid[gridX][gridY] = true;
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
            return { minX: 0, maxX: this.canvas.width, minY: 0, maxY: this.canvas.height };
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
        const padding = this.gridSize;
        return {
            minX: Math.max(0, minX - padding),
            maxX: Math.min(this.canvas.width, maxX + padding),
            minY: Math.max(0, minY - padding),
            maxY: Math.min(this.canvas.height, maxY + padding)
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
            
            // Check if scanline intersects this edge
            if ((p1.y <= y + epsilon && p2.y > y - epsilon) || (p1.y > y - epsilon && p2.y <= y + epsilon)) {
                const yDiff = p2.y - p1.y;
                
                // Avoid division by zero for horizontal edges
                if (Math.abs(yDiff) > epsilon) {
                    // Calculate intersection x coordinate
                    const intersectionX = p1.x + (y - p1.y) * (p2.x - p1.x) / yDiff;
                    intersections.push(intersectionX);
                }
            }
        }
        
        // Sort intersections by x coordinate
        intersections.sort((a, b) => a - b);
        
        return intersections;
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
        
        // Greedy algorithm: find largest possible rectangles first
        for (let gridX = 0; gridX < gridWidth; gridX++) {
            for (let gridY = 0; gridY < gridHeight; gridY++) {
                if (workingGrid[gridX][gridY]) {
                    // Find the largest rectangle starting at this position
                    const rect = this.findLargestRectangle(workingGrid, gridX, gridY);
                    
                    if (rect.width > 0 && rect.height > 0) {
                        fillBricks.push(rect);
                        
                        // Mark the rectangle area as filled in working grid
                        for (let x = rect.gridX; x < rect.gridX + rect.width; x++) {
                            for (let y = rect.gridY; y < rect.gridY + rect.height; y++) {
                                if (x < gridWidth && y < gridHeight) {
                                    workingGrid[x][y] = false;
                                }
                            }
                        }
                    }
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
        
        // Try different rectangle sizes
        for (let width = 1; startX + width <= gridWidth; width++) {
            for (let height = 1; startY + height <= gridHeight; height++) {
                // Check if this rectangle fits
                let fits = true;
                for (let x = startX; x < startX + width && fits; x++) {
                    for (let y = startY; y < startY + height && fits; y++) {
                        if (!grid[x][y]) {
                            fits = false;
                        }
                    }
                }
                
                if (fits) {
                    const area = width * height;
                    if (area > maxArea) {
                        maxArea = area;
                        bestRect = { gridX: startX, gridY: startY, width, height };
                    }
                } else {
                    // If this height doesn't fit, larger heights won't fit either
                    break;
                }
            }
        }
        
        return bestRect;
    }

    // Helper function to check if segment should have triangle drawn
    shouldDrawTriangle(startPoint, endPoint) {
        const dx = endPoint.x - startPoint.x;
        const dy = endPoint.y - startPoint.y;
        return Math.abs(dx) > 0.1 * this.gridSize && Math.abs(dy) > 0.1 * this.gridSize;
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
        // Set text style
        this.ctx.fillStyle = '#e67e22'; // Orange color for error text
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 3;
        
        // Draw error values for both boundaries
        [
            { points: leftPoints, rawPoints: rawLeftPoints, offsetX: -15 },
            { points: rightPoints, rawPoints: rawRightPoints, offsetX: 15 }
        ].forEach(({ points, rawPoints, offsetX }) => {
            for (let i = 0; i < points.length - 1; i++) {
                const segmentStart = points[i];
                const segmentEnd = points[i + 1];
                
                if (this.shouldDrawTriangle(segmentStart, segmentEnd)) {
                    const error = this.calculateAngularSegmentError(segmentStart, segmentEnd, rawPoints, i);
                    
                    // Position text at midpoint of segment, offset slightly
                    const midX = (segmentStart.x + segmentEnd.x) / 2;
                    const midY = (segmentStart.y + segmentEnd.y) / 2;
                    const offsetY = -5;
                    
                    // Draw white outline for text visibility
                    this.ctx.strokeText(`${error.toFixed(1)}px`, midX + offsetX, midY + offsetY);
                    // Draw the error text
                    this.ctx.fillText(`${error.toFixed(1)}px`, midX + offsetX, midY + offsetY);
                }
            }
        });
    }
    
    // Calculate error between an angular segment and the original curve portion it represents
    calculateAngularSegmentError(segmentStart, segmentEnd, rawPoints, segmentIndex) {
        let totalError = 0;
        let sampleCount = 0;
        
        // Sample points along the angular segment line
        const segmentLength = this.distance(segmentStart, segmentEnd);
        const numSamples = Math.max(5, Math.floor(segmentLength / 3)); // Sample every 3 pixels
        
        for (let i = 0; i <= numSamples; i++) {
            const t = i / numSamples;
            const linePoint = {
                x: segmentStart.x + t * (segmentEnd.x - segmentStart.x),
                y: segmentStart.y + t * (segmentEnd.y - segmentStart.y)
            };
            
            // Find the closest point in the entire raw curve
            let minDistance = Infinity;
            for (let j = 0; j < rawPoints.length; j++) {
                const distance = this.distance(linePoint, rawPoints[j]);
                minDistance = Math.min(minDistance, distance);
            }
            
            if (minDistance < Infinity) {
                totalError += minDistance * minDistance;
                sampleCount++;
            }
        }
        
        return sampleCount > 0 ? totalError / sampleCount : 0;
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
        
        if (Math.abs(dx) < this.gridSize * 0.1 || Math.abs(dy) < this.gridSize * 0.1) {
            return;
        }
        
        const cornerPoint = this.calculateTriangleCorner(startPoint, endPoint, side);
        
        this.ctx.beginPath();
        this.ctx.moveTo(startPoint.x, startPoint.y);
        this.ctx.lineTo(cornerPoint.x, cornerPoint.y);
        this.ctx.lineTo(endPoint.x, endPoint.y);
        this.ctx.closePath();
        
        this.ctx.fillStyle = this.getRGBAColorString(this.wedgeColor, 0.4);
        this.ctx.fill();
        this.ctx.stroke();
        
        const squareSize = this.gridSize * 0.2;
        this.ctx.strokeRect(
            cornerPoint.x - squareSize/2, 
            cornerPoint.y - squareSize/2, 
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
                this.ctx.beginPath();
                this.ctx.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length; i++) {
                    this.ctx.lineTo(points[i].x, points[i].y);
                }
                this.ctx.stroke();
            }
        });
        
        this.ctx.setLineDash([]);
    }
    
    // Create a 2D occupation grid to track which grid cells are occupied by triangles
    createOccupationGrid() {
        const gridWidth = Math.ceil(this.canvas.width / this.gridSize);
        const gridHeight = Math.ceil(this.canvas.height / this.gridSize);
        
        // Initialize 2D array with false (unoccupied)
        const grid = [];
        for (let x = 0; x < gridWidth; x++) {
            grid[x] = [];
            for (let y = 0; y < gridHeight; y++) {
                grid[x][y] = false;
            }
        }
        return grid;
    }
    
    // Convert canvas coordinates to grid indices
    canvasToGridIndex(x, y) {
        return {
            gridX: Math.floor(x / this.gridSize),
            gridY: Math.floor(y / this.gridSize)
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
            if (Math.abs(dx) > 0.1 * this.gridSize && Math.abs(dy) >  0.1 * this.gridSize) {
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
        const startGrid = this.canvasToGridIndex(minX, minY);
        const endGrid = this.canvasToGridIndex(maxX, maxY);
        
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
        const dx = endPoint.x - startPoint.x;
        const dy = endPoint.y - startPoint.y;
        
        if (Math.abs(dx) <= 1 || Math.abs(dy) <= 1) return false;
        
        if (side === 'right') {
            return this.wouldRectangleOverlap(startPoint, endPoint, occupationGrid);
        }
        
        return false;
    }
    
    wouldRectangleOverlap(startPoint, endPoint, occupationGrid) {
        const minX = Math.min(startPoint.x, endPoint.x);
        const maxX = Math.max(startPoint.x, endPoint.x);
        const minY = Math.min(startPoint.y, endPoint.y);
        const maxY = Math.max(startPoint.y, endPoint.y);
        
        const startGrid = this.canvasToGridIndex(minX, minY);
        const endGrid = this.canvasToGridIndex(maxX, maxY);
        
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
            const stepSize = this.gridSize;
            
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
        const minSegmentLength = this.gridSize * 0.8;
        const maxSegmentWidth = this.curveWidthInGrids * this.gridSize;
        const endThreshold = this.gridSize * 2; // Distance threshold for considering we're close enough to the end
        
        while (currentIndex < rawPoints.length - 1) {
            let bestNextIndex = currentIndex + 1;
            let bestScore = -Infinity;
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
                    
                    // Calculate score based on segment quality only
                    let score = 0;
                    
                    const segmentQuality = this.calculateSegmentQuality(currentPoint, candidatePoint, rawPoints, currentIndex, lookAhead);
                    score -= segmentQuality;
                    
                    // Bonus for angle alignment with the raw curve direction
                    const angleAlignment = this.calculateAngleAlignment(currentPoint, candidatePoint, rawPoints, currentIndex, lookAhead);
                    score += angleAlignment * 30;

                    
                    if (score > bestScore) {
                        bestScore = score;
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

    // Calculate how well the segment angle aligns with the raw curve direction
    calculateAngleAlignment(startPoint, endPoint, rawPoints, startIndex, endIndex) {
        if (startIndex >= endIndex || endIndex >= rawPoints.length) return 0;
        
        const segmentAngle = Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x);
        
        const rawStartPoint = rawPoints[startIndex];
        const rawEndPoint = rawPoints[Math.min(endIndex, rawPoints.length - 1)];
        const rawCurveAngle = Math.atan2(rawEndPoint.y - rawStartPoint.y, rawEndPoint.x - rawStartPoint.x);
        
        let angleDiff = segmentAngle - rawCurveAngle;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        const angleDifference = Math.abs(angleDiff);
        
        return Math.max(0, 1 - (angleDifference / (Math.PI / 2)));
    }

    drawGridPoints(leftPoints, rightPoints) {
        this.ctx.fillStyle = 'rgba(52, 152, 219, 0.8)';
        const radius = 3;
        
        // Draw points on both boundaries
        [...leftPoints, ...rightPoints].forEach(point => {
            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI);
            this.ctx.fill();
        });
    }
    
    reset() {
        this.generateBezierSegments();
        this.draw();
    }
    
    randomize() {
        const margin = 50;
        const maxX = this.canvas.width - margin;
        const maxY = this.canvas.height - margin;
        
        this.segments.forEach(segment => {
            const cp1 = {
                x: margin + Math.random() * (maxX - margin),
                y: margin + Math.random() * (maxY - margin)
            };
            const cp2 = {
                x: margin + Math.random() * (maxX - margin),
                y: margin + Math.random() * (maxY - margin)
            };
            
            segment.cp1 = this.snapToGrid(cp1);
            segment.cp2 = this.snapToGrid(cp2);
        });
        
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
        
        // Calculate fill bricks using the same logic as the visual representation
        const fillGrid = this.createFillGrid(simplifiedLeftPoints, simplifiedRightPoints, occupationGrid);
        const fillBricks = this.findOptimalFillBricks(fillGrid);
        
        // Update the current fill bricks to match what will be exported
        this.currentFillBricks = fillBricks;
        
        return {
            leftPoints: simplifiedLeftPoints,
            rightPoints: simplifiedRightPoints
        };
    }

    // Create a Brickadia save object from curve segments (using same logic as triangle drawing)
    createBrickadaSaveFromSegments(curveSegments) {
        const centerX = Math.round((this.canvas.width / 2) / this.gridSize) * this.gridSize;
        const centerY = Math.round((this.canvas.height / 2) / this.gridSize) * this.gridSize;
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
                        startPoint, endPoint, side, centerX, centerY
                    );
                    bricks.push(...segmentBricks);
                }
            }
        });
        
        if (this.currentFillBricks && this.currentFillBricks.length > 0) {
            const fillBricks = this.createBricksFromFillRectangles(this.currentFillBricks, centerX, centerY);
            bricks.push(...fillBricks);
        }
        
        return this.createBrickadiaBaseStructure(bricks, `Bezier curve with ${bricks.length} microbricks (cubes and wedges). Generated from curve editor.`);
    }

    // Create bricks for a triangle segment using the same logic as drawRightTriangle
    createBricksForTriangleSegment(startPoint, endPoint, side, centerX, centerY) {
        const dx = endPoint.x - startPoint.x;
        const dy = endPoint.y - startPoint.y;
        const bricks = [];
        
        if (Math.abs(dx) < this.gridSize * 0.1 || Math.abs(dy) < this.gridSize * 0.1) {
            return bricks;
        }
        
        const cornerPoint = this.calculateTriangleCorner(startPoint, endPoint, side);
        
        const triangleWidth = Math.abs(dx) / this.gridSize;
        const triangleHeight = Math.abs(dy) / this.gridSize;
        
        const centerPointX = (startPoint.x + endPoint.x) / this.gridSize;
        const centerPointY = (startPoint.y + endPoint.y) / this.gridSize;
        
        const centerGridX = (centerPointX - 2 * (centerX  / this.gridSize));
        const centerGridY = (centerPointY - 2 * (centerY / this.gridSize));
        
        const wedgeOrientation = this.getWedgeRotationFromTriangleCorner(dx, dy, side);
        
        const wedgeWidth = Math.max(1, Math.round(triangleWidth));
        const wedgeHeight = Math.max(1, Math.round(triangleHeight));
        bricks.push({
            asset_name_index: 1,
            size: [wedgeWidth, wedgeHeight, this.brickHeight],
            position: [centerGridX, centerGridY, (this.brickHeight - 1) * 2 + 1],
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
    createBricksFromFillRectangles(fillBricks, centerX, centerY) {
        const bricks = [];
        
        fillBricks.forEach(fillBrick => {
            // Convert grid coordinates to Brickadia coordinates
            const centerGridX = 2 * fillBrick.gridX + fillBrick.width;
            const centerGridY = 2 * fillBrick.gridY + fillBrick.height;
            
            const brickladiaX = (centerGridX - 2 * centerX / this.gridSize);
            const brickladiaY = (centerGridY - 2 * centerY / this.gridSize);
            
            bricks.push({
                asset_name_index: 0, // Use regular microbrick for fill
                size: [fillBrick.width, fillBrick.height, this.brickHeight],
                position: [brickladiaX, brickladiaY, (this.brickHeight - 1) * 2 + 1],
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

    // Check if a point should use a wedge based on direction changes (similar to triangle detection)
    shouldUseWedgeForPoint(dx1, dy1, dx2, dy2) {
        // Use the same logic as shouldDrawTriangle - check if both direction changes are significant
        const threshold = this.gridSize * 0.1; // Same threshold as drawRightTriangle
        
        // Check if we have significant movement in both directions for at least one of the segments
        const segment1HasDiagonal = Math.abs(dx1) > threshold && Math.abs(dy1) > threshold;
        const segment2HasDiagonal = Math.abs(dx2) > threshold && Math.abs(dy2) > threshold;
        
        // Also check if there's a clear directional change (not just continuing in the same direction)
        const directionChanged = this.hasSignificantDirectionChange(dx1, dy1, dx2, dy2);
        
        return (segment1HasDiagonal || segment2HasDiagonal) && directionChanged;
    }
    
    // Check if there's a significant direction change between two segments
    hasSignificantDirectionChange(dx1, dy1, dx2, dy2) {
        // Normalize direction vectors
        const length1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
        const length2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        
        if (length1 === 0 || length2 === 0) return false;
        
        const ndx1 = dx1 / length1;
        const ndy1 = dy1 / length1;
        const ndx2 = dx2 / length2;
        const ndy2 = dy2 / length2;
        
        // Calculate dot product to measure direction similarity
        const dotProduct = ndx1 * ndx2 + ndy1 * ndy2;
        
        // If dot product is close to 1, directions are very similar (no significant change)
        // If dot product is close to -1, directions are opposite
        // We want to detect corners, so look for dot products indicating angular changes
        return Math.abs(dotProduct) < 0.8; // Threshold for detecting significant direction change
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