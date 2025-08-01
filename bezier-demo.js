class BezierCurveDemo {
    constructor() {
        this.canvas = document.getElementById('bezierCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.isDragging = false;
        this.dragIndex = -1;
        this.dragType = null; // 'anchor' or 'control'
        this.showControlLines = true;
        this.showControlPoints = true;
        this.gridSnap = true;
        this.gridSize = 20;
        this.segmentCount = 3;
        
        // Define initial bezier segments
        this.generateSegments();
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.draw();
    }
    
    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        
        // Touch events for mobile
        this.canvas.addEventListener('touchstart', this.onTouchStart.bind(this));
        this.canvas.addEventListener('touchmove', this.onTouchMove.bind(this));
        this.canvas.addEventListener('touchend', this.onTouchEnd.bind(this));
        
        // Control buttons
        document.getElementById('resetBtn').addEventListener('click', this.reset.bind(this));
        document.getElementById('randomizeBtn').addEventListener('click', this.randomize.bind(this));
        
        // Segment count control
        document.getElementById('segmentCount').addEventListener('input', (e) => {
            this.segmentCount = parseInt(e.target.value);
            document.getElementById('segmentCountValue').textContent = this.segmentCount;
            this.generateSegments();
            this.draw();
        });
        
        // Checkboxes
        document.getElementById('showControlLines').addEventListener('change', (e) => {
            this.showControlLines = e.target.checked;
            this.draw();
        });
        
        document.getElementById('showControlPoints').addEventListener('change', (e) => {
            this.showControlPoints = e.target.checked;
            this.draw();
        });
        
        document.getElementById('gridSnap').addEventListener('change', (e) => {
            this.gridSnap = e.target.checked;
            this.draw();
        });
        
        document.getElementById('gridSize').addEventListener('input', (e) => {
            this.gridSize = parseInt(e.target.value);
            document.getElementById('gridSizeValue').textContent = this.gridSize;
            this.draw();
        });
    }
    
    generateSegments() {
        this.segments = [];
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        const segmentWidth = (canvasWidth - 200) / this.segmentCount;
        
        for (let i = 0; i < this.segmentCount; i++) {
            const startX = 100 + (i * segmentWidth);
            const endX = 100 + ((i + 1) * segmentWidth);
            const centerY = canvasHeight / 2;
            
            this.segments.push({
                start: { x: startX, y: centerY },
                cp1: { x: startX + segmentWidth * 0.25, y: centerY - 100 },
                cp2: { x: startX + segmentWidth * 0.75, y: centerY + 100 },
                end: { x: endX, y: centerY }
            });
        }
        
        // Ensure continuity between segments
        for (let i = 1; i < this.segments.length; i++) {
            this.segments[i].start = this.segments[i - 1].end;
        }
    }
    
    snapToGrid(point) {
        if (!this.gridSnap) return point;
        
        return {
            x: Math.round(point.x / this.gridSize) * this.gridSize,
            y: Math.round(point.y / this.gridSize) * this.gridSize
        };
    }
    
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }
    
    getTouchPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.touches[0].clientX - rect.left,
            y: e.touches[0].clientY - rect.top
        };
    }
    
    findNearestPoint(pos) {
        const threshold = 15;
        
        for (let i = 0; i < this.segments.length; i++) {
            const segment = this.segments[i];
            
            // Check anchor points
            if (this.distance(pos, segment.start) < threshold) {
                return { segmentIndex: i, pointType: 'start', point: segment.start };
            }
            if (this.distance(pos, segment.end) < threshold) {
                return { segmentIndex: i, pointType: 'end', point: segment.end };
            }
            
            // Check control points
            if (this.distance(pos, segment.cp1) < threshold) {
                return { segmentIndex: i, pointType: 'cp1', point: segment.cp1 };
            }
            if (this.distance(pos, segment.cp2) < threshold) {
                return { segmentIndex: i, pointType: 'cp2', point: segment.cp2 };
            }
        }
        
        return null;
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
        this.ctx.lineWidth = 3;
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
            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, type === 'anchor' ? 8 : 6, 0, 2 * Math.PI);
            this.ctx.fillStyle = color;
            this.ctx.fill();
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        });
    }
    
    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw grid if snap is enabled
        this.drawGrid();
        
        // Draw each segment
        this.segments.forEach(segment => {
            this.drawControlLines(segment);
            this.drawBezierSegment(segment);
            this.drawControlPoints(segment);
        });
        
        // Draw segment numbers
        this.segments.forEach((segment, index) => {
            const midX = (segment.start.x + segment.end.x) / 2;
            const midY = (segment.start.y + segment.end.y) / 2;
            
            this.ctx.fillStyle = '#34495e';
            this.ctx.font = '16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`Segment ${index + 1}`, midX, midY - 20);
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
    
    reset() {
        this.generateSegments();
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
}

// Initialize the demo when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new BezierCurveDemo();
});
