class PathFinder {
    private Table missionTable;
    private Table elevationTable;
    private String mapFile;
    private String missionFile;

    private PVector startPoint, endPoint;
    private ArrayList<PVector> path;
    private int width, height;
    private float[][] mapGrid;
    

    public PathFinder(String mapFile, String missionFile) {
        this.mapFile = mapFile;
        this.missionFile = missionFile;
        this.path = new ArrayList<PVector>();
    }

    private void loadMapData(){
        this.elevationTable = loadTable(this.mapFile, "header");
    }

    private void loadMissionData(){
        this.missionTable = loadTable(this.missionFile, "header");
       
        //parse the missionTable for the start PVector and the end PVector
        TableRow startRow = this.missionTable.getRow(0);
        
        this.startPoint = new PVector(startRow.getFloat("xStartPosition"), startRow.getFloat("yStartPosition"));
        this.endPoint = new PVector(startRow.getFloat("xEndPosition"), startRow.getFloat("yEndPosition"));

        //parse the missionTable for the start PVector and the end PVector
        this.width = (int) startRow.getFloat("width");
        this.height = (int) startRow.getFloat("height");


        // set grid size
        
        this.mapGrid = new float[this.width][this.height];

        // println("Map grid initialized with dimensions: " +  this.width + " x " + this.height);


    }

    public PVector getStartPoint(){
        //read the start point from the mission data file
        
        return this.startPoint;
    }

    public PVector getEndPoint(){
        //read the end point from the mission data file
        ;
        return this.endPoint;
    }

    // Getters for the start point, end point, and data file
    public String getMapFile() {
        return mapFile;
    }

    public String getMissionFile() {
        return missionFile;
    }

    // Setters for the start point, end point, and data fileS
    public void setMapFile(String mapFile) {
        this.mapFile = mapFile;
    }

    public void setMissionFile(String missionFile) {
        this.missionFile = missionFile;
    }

    // Method to calculate the distance between the start and end points
    public float getDistance() {
        return PVector.dist(this.startPoint, this.endPoint);
    }

    // Method to calculate the direction from the start point to the end point
    public PVector getDirection() {
        PVector direction = PVector.sub(this.endPoint, this.startPoint);
        direction.normalize();
        return direction;
    }

    public void addPathPoint(PVector pathPoint){
        this.path.add(pathPoint);
    }

    public ArrayList<PVector> getPath() {
        // Placeholder implementation, replace with actual pathfinding logic
        return path;
    }

    public PVector getPathPoint(int index) {
        // Placeholder implementation, replace with actual pathfinding logic
        return path.get(index);
    }

    public PVector[] getNeighbors(PVector currentPosition){
            
        PVector[] neighbors = new PVector[8];

        for(int i = -1; i < 1; i++){
            for(int j = -1; j < 1; j++){

                int loc = (i + 1) * 3 + (j + 1);

                int xPositionNeighbor = (int) currentPosition.x + i; 
                int yPositionNeighbor = (int) currentPosition.y + j;

                if(xPositionNeighbor < 0 || xPositionNeighbor > this.width || yPositionNeighbor < 0 || yPositionNeighbor > this.height) {
                    neighbors[loc] = null;
                    continue;
                }
                else{
                    neighbors[loc] = new PVector(xPositionNeighbor, yPositionNeighbor, this.mapGrid[xPositionNeighbor][yPositionNeighbor]);
                }
            }
        }

        println("Neighbors calculated for position: " + currentPosition);
        for(int i = 0; i < neighbors.length; i++){
            println("Neighbor " + i + ": " + neighbors[i]);
        }

        return neighbors;

    }

    public void calculatePath() { 
        //Placeholder implementation
        loadMapData();
        loadMissionData();

        //Here you would implement the actual A* pathfinding algorithm using the loaded map and mission data.

        PVector startPoint = getStartPoint();
        PVector endPoint = getEndPoint();


    }

}