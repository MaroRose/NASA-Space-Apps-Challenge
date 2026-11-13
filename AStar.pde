class AStar {
    private Table missionTable;
    private Table elevationTable;
    private String mapFile;
    private String missionFile;

    private PVector startPoint, endPoint;

    public AStar(String mapFile, String missionFile) {
        // Initialize the start and end points
        this.mapFile = mapFile;
        this.missionFile = missionFile;
        this.startPoint = new PVector();
        this.endPoint = new PVector();
    }

    private void loadMapData(){
        this.elevationTable = loadTable(this.mapFile, "header");
    }

    private void loadMissionData(){
        this.missionTable = loadTable(this.missionFile, "header");
       
        //parse the dataFile for the start PVector and the end PVector

        TableRow startRow = this.missionTable.getRow(0);
        this.startPoint = new PVector(startRow.getFloat("x"), startRow.getFloat("y"));

        TableRow endRow = this.missionTable.getRow(1);
        this.endPoint = new PVector(endRow.getFloat("x"), endRow.getFloat("y"));


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

    public PVector[] getPath() {
        // Placeholder implementation, replace with actual pathfinding logic
        PVector[] path = new PVector[2];

        path[0] = getStartPoint();
        path[1] = getEndPoint();

        return path;
    }
}