class PathFinder {
    private Table missionTable;
    private Table elevationTable;
    private String mapFile;
    private String missionFile;

    private PVector startPoint, endPoint;
    private ArrayList<PVector> path;
    private int width, height;
    private float[][] mapGrid;
    private PVector[][] parentGrid;

    public PathFinder(String mapFile, String missionFile) {
        this.mapFile = mapFile;
        this.missionFile = missionFile;
        this.path = new ArrayList<PVector>();
    }

    private void loadMapElevationData(){
        this.elevationTable = loadTable(this.mapFile, "header");
        if (this.elevationTable == null) {
            throw new IllegalStateException("Unable to load elevation data: " + this.mapFile);
        }
    }

    private void loadMissionInputData(){
        this.missionTable = loadTable(this.missionFile, "header");
        if (this.missionTable == null || this.missionTable.getRowCount() == 0) {
            throw new IllegalStateException("Unable to load mission data: " + this.missionFile);
        }
       
        //parse the missionTable for the start PVector and the end PVector
        TableRow startRow = this.missionTable.getRow(0);
        
        this.startPoint = new PVector(startRow.getFloat("xStartPosition"), startRow.getFloat("yStartPosition"));
        this.endPoint = new PVector(startRow.getFloat("xEndPosition"), startRow.getFloat("yEndPosition"));

        //parse the missionTable for the start PVector and the end PVector
        this.width = (int) startRow.getFloat("width");
        this.height = (int) startRow.getFloat("height");


        // set grid size
        if (this.width <= 0 || this.height <= 0) {
            throw new IllegalArgumentException("Mission map dimensions must be positive.");
        }
        this.mapGrid = new float[this.width][this.height];
        this.parentGrid = new PVector[this.width][this.height];
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
    public float getDistance(PVector pointA, PVector pointB) {
        return PVector.dist(pointA, pointB);
    }

    public void addPathPoint(PVector pathPoint){
        this.path.add(pathPoint);
    }

    public ArrayList<PVector> getPath() {
        return path;
    }

    public PVector getPathPoint(int index) {
        return path.get(index);
    }

    public PVector[] getNeighbors(PVector currentPosition){
        PVector[] neighbors = new PVector[8];

        for (int dx = -1; dx <= 1; dx++) {
            for (int dy = -1; dy <= 1; dy++) {
                if (dx == 0 && dy == 0) {
                    continue;
                }

                int index = (dx + 1) * 3 + dy + 1;
                if (index > 4) {
                    index--;
                }

                int x = (int) currentPosition.x + dx;
                int y = (int) currentPosition.y + dy;
                if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
                    neighbors[index] = new PVector(x, y, this.mapGrid[x][y]);
                }
            }
        }

        return neighbors;
    }

    private void loadElevationGrid() {
        for (int x = 0; x < this.width; x++) {
            for (int y = 0; y < this.height; y++) {
                this.mapGrid[x][y] = Float.NaN;
            }
        }

        for (TableRow row : this.elevationTable.rows()) {
            int x = row.getInt("xPosition");
            int y = row.getInt("yPosition");
            if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
                this.mapGrid[x][y] = row.getFloat("zPosition");
            }
        }
    }

    private boolean isTraversable(int x, int y) {
        float elevation = this.mapGrid[x][y];
        return !Float.isNaN(elevation) && !Float.isInfinite(elevation);
    }

    private float heuristic(int x, int y, int endX, int endY) {
        return PVector.dist(new PVector(x, y), new PVector(endX, endY));
    }

    private void buildPath(int endX, int endY) {
        ArrayList<PVector> reversedPath = new ArrayList<PVector>();
        int x = endX;
        int y = endY;
        reversedPath.add(new PVector(x, y, this.mapGrid[x][y]));

        while (x != (int) this.startPoint.x || y != (int) this.startPoint.y) {
            PVector parent = this.parentGrid[x][y];
            if (parent == null) {
                throw new IllegalStateException("Path reconstruction failed.");
            }
            x = (int) parent.x;
            y = (int) parent.y;
            reversedPath.add(new PVector(x, y, this.mapGrid[x][y]));
        }

        for (int i = reversedPath.size() - 1; i >= 0; i--) {
            this.path.add(reversedPath.get(i));
        }
    }

    public void calculatePath() { 
        this.path.clear();
        loadMissionInputData();
        loadMapElevationData();
        loadElevationGrid();

        int startX = (int) this.startPoint.x;
        int startY = (int) this.startPoint.y;
        int endX = (int) this.endPoint.x;
        int endY = (int) this.endPoint.y;
        if (startX < 0 || startX >= this.width || startY < 0 || startY >= this.height
                || endX < 0 || endX >= this.width || endY < 0 || endY >= this.height) {
            throw new IllegalArgumentException("Mission start and end points must be inside the map.");
        }
        if (!isTraversable(startX, startY) || !isTraversable(endX, endY)) {
            throw new IllegalArgumentException("Mission start and end points must have valid elevation data.");
        }

        float[][] gScore = new float[this.width][this.height];
        boolean[][] closedSet = new boolean[this.width][this.height];
        for (int x = 0; x < this.width; x++) {
            for (int y = 0; y < this.height; y++) {
                gScore[x][y] = Float.POSITIVE_INFINITY;
            }
        }

        class SearchNode {
            int x;
            int y;
            float gCost;
            float fCost;

            SearchNode(int x, int y, float gCost, float fCost) {
                this.x = x;
                this.y = y;
                this.gCost = gCost;
                this.fCost = fCost;
            }
        }

        java.util.PriorityQueue<SearchNode> openSet = new java.util.PriorityQueue<SearchNode>(
            11,
            new java.util.Comparator<SearchNode>() {
                public int compare(SearchNode first, SearchNode second) {
                    return Float.compare(first.fCost, second.fCost);
                }
            }
        );

        gScore[startX][startY] = 0;
        openSet.add(new SearchNode(startX, startY, 0, heuristic(startX, startY, endX, endY)));

        while (!openSet.isEmpty()) {
            SearchNode current = openSet.poll();
            if (current.gCost > gScore[current.x][current.y] || closedSet[current.x][current.y]) {
                continue;
            }
            if (current.x == endX && current.y == endY) {
                buildPath(endX, endY);
                return;
            }

            closedSet[current.x][current.y] = true;
            PVector currentPoint = new PVector(
                current.x,
                current.y,
                this.mapGrid[current.x][current.y]
            );
            for (PVector neighbor : getNeighbors(currentPoint)) {
                if (neighbor == null) {
                    continue;
                }
                int neighborX = (int) neighbor.x;
                int neighborY = (int) neighbor.y;
                if (closedSet[neighborX][neighborY] || !isTraversable(neighborX, neighborY)) {
                    continue;
                }

                float tentativeG = current.gCost + PVector.dist(currentPoint, neighbor);
                if (tentativeG < gScore[neighborX][neighborY]) {
                    this.parentGrid[neighborX][neighborY] = currentPoint;
                    gScore[neighborX][neighborY] = tentativeG;
                    float fCost = tentativeG + heuristic(neighborX, neighborY, endX, endY);
                    openSet.add(new SearchNode(neighborX, neighborY, tentativeG, fCost));
                }
            }
        }

        throw new IllegalStateException("No traversable path exists between the mission points.");
    }

}