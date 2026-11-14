PImage img;
PathFinder pathFinder;
ArrayList<PVector> finalPath;

void settings() {
  size(100,100);
}

void setup(){
  println("Loading Elevation Map...");
  img = loadImage("data/Lunar_Elevation_Map.jpg");
  println("Elevation Map Loaded.");
  windowResize(img.width, img.height);

  finalPath = new ArrayList<PVector>();

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

  pathFinder = new PathFinder("data/Elevation.csv", "data/MissionInputData.csv");

  pathFinder.loadMapData();
  pathFinder.loadMissionData();

  PVector startPoint = pathFinder.getStartPoint();
  PVector endPoint = pathFinder.getEndPoint();

  pathFinder.addPathPoint(startPoint);
  
  PVector[] samplePoints = {new PVector(100,200), new PVector(150,250), new PVector(200,300)};

  for(int i = 0; i < samplePoints.length; i++){
    PVector samplePoint = samplePoints[i];
    pathFinder.addPathPoint(samplePoint);
  }

  // Print the neighbors of the sample point
  // PVector[] neighbors = pathFinder.getNeighbors(samplePoint);
  // for(int i = 0; i < neighbors.length; i++){
  //   println("Neighbor " + i + ": " + neighbors[i]);
  // }

  // Draw the path on the image
  strokeWeight(1);
  stroke(255);
  noFill();
  beginShape();
  for (int i = 0; i < pathFinder.getPath().size(); i++) {
    vertex(pathFinder.getPathPoint(i).x, pathFinder.getPathPoint(i).y);
  }
  endShape();

  for(int i = 0; i < pathFinder.getPath().size(); i++) {
    strokeWeight(5);
    stroke(0);
    point(pathFinder.getPathPoint(i).x, pathFinder.getPathPoint(i).y);
  }

  finalPath = pathFinder.getPath();

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