
// Milliseconds between frame updates
let speed_ = 33;		// ~30 frames per second

let screenWidth_ = 512, screenHeight_ = 512;
let centerX_, centerY_;
let scale_;
let down_ = false;

let mousePt_;
let probeX_ = 1e10, probeY_ = 1e10;

let damping_ = 0.97;		// damping constant
let gravity_ = 0.005;	// gravitational constant
let magnetism_ = 0.1;
let height_ = 0.1;		// vertical distance from magnets
let mass_ = 1.0;			// mass of Tripolar
let dtSim_ = 0.0015;		// time step

let lastPath_ = null;	// most recently drawn path, for PDF export

let magnetX_ = [0, 0, 0];
let magnetY_ = [0, 0, 0];

function setup() {
  // Supersample the fine strokes, including on standard-density displays.
  pixelDensity(3);
  createCanvas(screenWidth_, screenHeight_).parent('sketch');
  background(255);
  fill(0);
  strokeWeight(0.65);
  stroke(0, 160);
  frameRate(1000 / speed_);

  mousePt_ = createVector(0,0);
  
  centerX_ = screenWidth_ / 2.0;
  centerY_ = screenHeight_ / 2.0;
  scale_ = min(centerX_, centerY_);		// scale to normalize
  
  // mousePt_ = new Point();
  // magnetX_ = new double [3];
  // magnetY_ = new double [3];
  
  setMagnets(0.5);
}

// create three magnets at given radius from center
function setMagnets(r) {
  magnetX_[0] = r * cos(PI/2);
  magnetY_[0] = r * sin(PI/2);
  magnetX_[1] = r * cos(PI/2 + (2*PI) / 3);
  magnetY_[1] = r * sin(PI/2 + (2*PI) / 3);
  magnetX_[2] = r * cos(PI/2 - (2*PI) / 3);
  magnetY_[2] = r * sin(PI/2 - (2*PI) / 3);
}

// performs the simulation of the Tripolar and draws the path
function updatePaths(x, y) {
  const pts = computePath(x, y);
  for (let i = 2; i < pts.length; i += 2) {
    drawNormalizedLine(pts[i-2], pts[i-1], pts[i], pts[i+1]);
  }
  lastPath_ = pts;
  const button = document.getElementById('download-pdf');
  if (button) button.disabled = false;
}

// returns the path as a flat [x0, y0, x1, y1, ...] array in normalized coordinates
function computePath(x, y) {
  const pts = [x, y];
  let vX=0, vY=0;	// velocity
  let fX,fY;
  let r, over_rsq, over_rcube;
  let dx, dy;
  let filtVel = 1;
  let iter = 0;
  
  // Low threshold so the small time step can settle onto the magnet
  while (filtVel > 0.005 && iter < 20000) {
    iter++;
    fX=0;
    fY=0;	// zero forces
    
    // simulate gravitational pull towards center
    r = x*x + y*y;
    if (r < 0.00001) 
    r= 0.00001;
    
    over_rsq = 1.0 / r;
    fX -= (x * gravity_) * over_rsq;
    fY -= (y * gravity_) * over_rsq;
    
    // simulate magnetic forces towards three magnets using 
    // Coulomb's 2nd law - attraction falls off with distance square
    for (let m = 0; m < 3; m++) {
      dx = magnetX_[m] - x;
      dy = magnetY_[m] - y;
      r = sqrt(dx*dx + dy*dy + height_*height_);
      if (r < 0.00001) 
      r = 0.00001;
      over_rcube = 1.0 / (r*r*r);
      
      fX += magnetism_ * dx * over_rcube;
      fY += magnetism_ * dy * over_rcube;
    }
    
    // friction proportional to velocity
    fX -= vX*damping_;
    fY -= vY*damping_;
    
    // Apply forces using Newton's Law: F=mA
    vX += dtSim_ * fX / mass_;
    vY += dtSim_ * fY / mass_;
    
    // compute filtered velocity, to determine when the Tripolar stops
    filtVel = 0.99 * filtVel + 0.1 * max(abs(vX), abs(vY));
    x += vX;
    y += vY;
    pts.push(x, y);
  }
  return pts;
}

function drawNormalizedLine(x1, y1, x2, y2) {
  // Keep sub-pixel precision so the canvas can antialias the path
  line(x1 * scale_ + centerX_, 
       y1 * scale_ + centerY_, 
       x2 * scale_ + centerX_, 
       y2 * scale_ + centerY_);
}

function draw() {
  if (!down_) return;
  
  background(255);

  // interpolate from probe position to mouse position
  if (probeX_ == 1e10) {
    probeX_ = mousePt_.x;
    probeY_ = mousePt_.y;
  }
  
  dx = mousePt_.x - probeX_;
  dy = mousePt_.y - probeY_;
  distSq = dx*dx + dy*dy;
  
  if (distSq > 1) {	// exponentially proceed to pixel clicked on
    probeX_ += dx/2;
    probeY_ += dy/2;
  } else {			// logarithmically interpolate over last pixel
                // This allows one to explore values between pixels
                // by "pulling" the actual probe very slowly towards
                // the mouse position.
    probeX_ += dx * 0.01;
    probeY_ += dy * 0.01;
  }

  if (probeX_ != 1e10) {
    updatePaths((probeX_ - centerX_) / scale_, 
                (probeY_ - centerY_) / scale_);
  }
}

  function mousePressed() {
    if (mouseX < 0 || mouseX >= width || mouseY < 0 || mouseY >= height) return;
    down_ = true;
		mousePt_.set(mouseX, mouseY);
  }
  
  function mouseDragged() {
		if (down_) {
			mousePt_.set(mouseX, mouseY);
		}
  }
  
  function mouseReleased() {
    down_ = false;
  }

// Saves the current path as a vector PDF with a small title and credit.
function downloadPDF() {
  if (!lastPath_ || !window.jspdf) return;

  const lang = navigator.language || '';
  const format = /^en-(US|CA)$/i.test(lang) ? 'letter' : 'a4';
  const doc = new window.jspdf.jsPDF({ unit: 'pt', format: format, compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const margin = 72;
  const size = pageW - 2 * margin;
  const left = margin;
  const top = margin;
  const s = size / 2;		// normalized units to points
  const cx = left + s, cy = top + s;

  doc.setProperties({
    title: 'Tripolar',
    author: 'Scott Snibbe',
    subject: 'Tripolar, Scott Snibbe, 2002',
    creator: 'https://tripolar.snibbe.com/'
  });

  // One continuous solid path, so segment joints don't show as overlapping dots.
  doc.saveGraphicsState();
  doc.rect(left, top, size, size, null);
  doc.clip();
  doc.discardPath();
  doc.setDrawColor(0);
  doc.setLineWidth(0.65 * size / screenWidth_);
  doc.setLineCap('round');
  doc.setLineJoin('round');
  const pts = lastPath_;
  doc.moveTo(cx + pts[0] * s, cy + pts[1] * s);
  // Smooth curves through every simulated point (Catmull-Rom tangents as Bezier controls).
  for (let i = 2; i < pts.length; i += 2) {
    const p0 = Math.max(0, i - 4);
    const p1 = i - 2;
    const p2 = i;
    const p3 = Math.min(pts.length - 2, i + 2);
    doc.curveTo(
      cx + (pts[p1] + (pts[p2] - pts[p0]) / 6) * s,
      cy + (pts[p1+1] + (pts[p2+1] - pts[p0+1]) / 6) * s,
      cx + (pts[p2] - (pts[p3] - pts[p1]) / 6) * s,
      cy + (pts[p2+1] - (pts[p3+1] - pts[p1+1]) / 6) * s,
      cx + pts[p2] * s,
      cy + pts[p2+1] * s
    );
  }
  doc.stroke();
  doc.restoreGraphicsState();

  // The filename records when the print was made; it doubles as the print's
  // date/time line in the credit.
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const name = 'tripolar-snibbe-' +
    now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + '-' +
    pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());

  const right = left + size;
  const bottom = pageH - margin;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(0);
  doc.text('Tripolar', right, bottom - 36, { align: 'right' });
  doc.text('Scott Snibbe, 2002', right, bottom - 24, { align: 'right' });
  doc.setTextColor(110);
  doc.text(name, right, bottom - 12, { align: 'right' });
  doc.text('tripolar.snibbe.com', right, bottom, { align: 'right' });

  doc.save(name + '.pdf');
}
