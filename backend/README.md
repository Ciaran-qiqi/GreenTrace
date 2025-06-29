├── cmd/              # Main program entry
│   └── server/      # Server entry
├── pkg/             # Core functionality packages
│   ├── crawler/     # Crawler logic
│   ├── logger/      # Logging
│   ├── models/      # Data models
│   └── storage/     # Data storage
├── data/            # Data storage directory
├── logs/            # Log files directory
├── go.mod           # Go module definition
└── go.sum           # Dependency version lock

We currently have three API endpoints:

1. Get latest price

* Path: GET /api/carbon-price
* Function: Get the latest carbon price information
* Returns:
* Success: 200 status code with price information
* Failure: 404 status code with error message

2. Get historical records

* Path: GET /api/carbon-price/history
* Function: Get all historical price records
* Returns: 200 status code with historical price list

3. Manual price update

* Path: POST /api/carbon-price/update
* Function: Manually trigger price update
* Returns:
* Success: 200 status code with updated price information
* Failure: 500 status code with error message

All APIs support cross-origin access (CORS) and have detailed logging.

You can test these APIs in the following ways:

1. Use browser to access http://localhost:5000/api/carbon-price
2. Use Postman or other API testing tools
3. Use curl commands, for example:

   bash

   curl http://localhost:5000/api/carbon-price

   curl http://localhost:5000/api/carbon-price/history

   curl -X POST http://localhost:5000/api/carbon-price/update
