PImage img;
AStar pathFinder;
PVector start,end;
PVector[] path;

void settings() {
  size(100,100);
}

void setup(){
  img = loadImage("data/Lunar_Elevation_Map.jpg");

  windowResize(img.width, img.height);
}

void draw() {
  image(img, 0, 0);
  img.loadPixels();

  PrintWriter output = createWriter("data/Elevation.csv");
  output.println("xPosition,yPosition,zPosition");

  for (int y = 0; y < img.height; y++) {
    int rowOffset = y * img.width;
    for (int x = 0; x < img.width; x++) {
      float z = brightness(img.pixels[rowOffset + x]);
      output.println(x + "," + y + "," + z);
    }
  }

  output.close();
  noLoop();

  pathFinder = new AStar("data/Elevation.csv", "data/missionInputData.csv");

  // start = pathFinder.getStartPoint();
  // end = pathFinder.getEndPoint();
  // path = pathFinder.getPath();

  start = new PVector(0, 0);
  end = new PVector(100,100);
  path = new PVector[] { start, end };

  // Draw the path on the image
  stroke(255);
  noFill();
  beginShape();
  for (int i = 0; i < path.length; i++) {
    vertex(path[i].x, path[i].y);
  }
  endShape();

  // Draw the start and end points
  noStroke();
  fill(0, 255, 0);
  ellipse(start.x, start.y, 10, 10);
  fill(255, 0, 0);
  ellipse(end.x, end.y, 10, 10);
}