PImage img;
Table table;

void setup(){
  
  
  
  img = loadImage("data/Lunar_Elevation_Map.jpg");
  
  windowResize(img.width,img.height);
  
  table = new Table();
  
  table.addColumn("xPosition", Table.INT);
  table.addColumn("yPosition", Table.INT);
  table.addColumn("zPosition", Table.FLOAT);
}

void draw() {
  loadPixels();

  // We must also call loadPixels() on the PImage since we are going to read its pixels.
  img.loadPixels();
  
  for (int y = 0; y < height; y++ ) {
      TableRow row = table.addRow();
      row.setInt("yPosition", y);

    for (int x = 0; x < width; x++ ) {
      
      int loc = x + y * width;
      
      // The functions red(), green(), and blue() pull out the three color components from a pixel.
      float r = red(img.pixels[loc]); 
      float g = green(img.pixels[loc]);
      float b = blue(img.pixels[loc]);
      
      // Set the display pixel to the image pixel
      pixels[loc] = color(r, g, b);
      
      float z = brightness(img.pixels[loc]);
      
      row.setInt("xPosition", x);
      
      
      row.setFloat("zPosition", z);
    }
  }
  
  updatePixels();
  saveTable(table, "data/Elevation.csv");

}
