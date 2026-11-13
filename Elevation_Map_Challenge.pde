PImage img;

void setup(){
  img = loadImage("data/Lunar_Elevation_Map.jpg");
  windowResize(img.width,img.height);
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
}