module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.renameColumn('MovieGenres', 'movieId', 'movie_id');
    await queryInterface.renameColumn('MovieGenres', 'genreId', 'genre_id');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.renameColumn('MovieGenres', 'movie_id', 'movieId');
    await queryInterface.renameColumn('MovieGenres', 'genre_id', 'genreId');
  },
};
