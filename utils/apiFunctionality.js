class ApiFunctionality {
  constructor(query, queryStr) {
    this.query = query;
    this.queryStr = queryStr;
  }

  search() {
    if (this.queryStr.keyword) {
      const keyword = this.queryStr.keyword.trim();
      this.query = this.query.find({
        $or: [
          { name: { $regex: keyword, $options: "i" } },
          { description: { $regex: keyword, $options: "i" } },
          { category: { $regex: keyword, $options: "i" } },
        ],
      });
    }
    return this;
  }

  filter() {
    const queryCopy = { ...this.queryStr };

    // Remove non-filter fields
    const removeFields = ["keyword", "page", "limit", "sort", "fields"];
    removeFields.forEach((key) => delete queryCopy[key]);

    // Convert operators: price[gte]=100 becomes price: { $gte: 100 }
    let queryStr = JSON.stringify(queryCopy);
    queryStr = queryStr.replace(
      /\b(gt|gte|lt|lte|ne|in)\b/g,
      (match) => `$${match}`
    );

    const parsedQuery = JSON.parse(queryStr);

    // Only apply filter if there are actual filters
    if (Object.keys(parsedQuery).length > 0) {
      this.query = this.query.find(parsedQuery);
    }

    return this;
  }
  pagination(resultPerPage) {
    const currentPage = Number(this.queryStr.page) || 1;
    const skip = resultPerPage * (currentPage - 1);
    this.query = this.query.limit(resultPerPage).skip(skip);
    return this;
  }
}

export default ApiFunctionality;
