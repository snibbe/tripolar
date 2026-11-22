
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
  let vX=0, vY=0;	// velocity
  let fX,fY;
  let r, over_rsq, over_rcube;
  let dx, dy;
  let filtVel = 1;
  let lastX, lastY;
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
    lastX = x;
    lastY = y;
    x += vX;
    y += vY;
    
    drawNormalizedLine(lastX, lastY, x, y);
  }
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
