const User = require("../models/User");
const Song = require("../models/Songs");
const Playlist = require("../models/Playlist");
const customErrors = require(`../errors`);
const { StatusCodes } = require("http-status-codes");
const client = require(`../redis-client`);
const express = require(`express`);
const app = express();
const bodyParser = require('body-parser');
app.use(express.json);
app.use(bodyParser.json);

const getRecommendations = async (req, res) => {
    const userId = req.user.userId;
    const user = await User.findOne({_id: userId });
    if(!user) {
        throw new customErrors.notFoundError("No user found");
    }
    console.log("Checking cache");
    const redisRecommendations = await client.get(`recommendations:${userId}`);
    if(redisRecommendations) {
        return res.status(StatusCodes.OK).json({ recommendations: JSON.parse(redisRecommendations) });
    }
    console.log("Not found in cache");
    const { likedSingers, favoriteGenres, recentlyPlayed } = user;
    
    const genreBasedSongs = await Song.find({ genre: { $in: favoriteGenres } });
    const singerBasedSongs = await Song.find({ artist: { $in: likedSingers.map(singer => singer._id) } });
    const genreBasedPlaylists = await Playlist.find({ genre: { $in: favoriteGenres } });
    const recentlyPlayedSongs = await Song.find({ _id: { $in: recentlyPlayed } });

    const recommendations = {
        songs: {
            genreBased: genreBasedSongs,
            singerBased: singerBasedSongs,
            recentlyPlayed: recentlyPlayedSongs,
        },
        playlists: genreBasedPlaylists,
    };

    await client.set(`recommendations:${userId}`, JSON.stringify(recommendations));
    await client.expire(`recommendations:${userId}`, 172800);
    return res.status(StatusCodes.OK).json({ recommendations });
};

module.exports = getRecommendations;