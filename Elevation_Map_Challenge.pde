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

float elevationAt(String elevationCSV, float x, float y){
  Table table = loadTable(elevationCSV, "header");
  for(TableRow row : table.rows()){
    float rowX = row.getFloat("xPosition");
    float rowY = row.getFloat("yPosition");
    float rowZ = row.getFloat("zPosition");
    if(rowX == x && rowY == y){
      return rowZ;
    }
  } 
  return 0; // Return 0 if the coordinates are not found
}

void draw() {
  image(img, 0, 0);
  img.loadPixels();

  PrintWriter output = createWriter("data/Elevation.csv");
  output.println("xPosition,yPosition,zPosition");

  for (int x = 0; x < img.width; x++) {
  for (int y = 0; y < img.height; y++) {
    int rowOffset = y * img.width;
    
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


  loop();
  //Display text to show the longitude and latitude coordinates as the user hovers the mouse over the window

  float logitude, latitude, elevation;

  logitude = mouseX;
  latitude = mouseY;
  elevation = elevationAt("data/Elevation.csv", logitude, latitude);


  fill(255);
  noStroke();
  text("Coordinates: " + "(" + logitude + " , " + latitude + " , " + elevation + ")", 0, height - 10);
}