import { Text, View, ScrollView, StyleSheet, TouchableOpacity, Switch } from "react-native";
import Poster from "../../components/Poster";
import { AntDesign, FontAwesome } from '@expo/vector-icons';
import { useEffect, useState, useContext, useCallback } from "react";
import { getFirestore, collection, query, where, getDoc, doc, orderBy, updateDoc, onSnapshot } from 'firebase/firestore';
import ReviewItem from "../../components/ReviewItem";
import { UserContext } from "../context/UserContext";
import SelectDropdown from 'react-native-select-dropdown'

const db = getFirestore()
export default function MovieDetail({ route, navigation }) {
    const { movie } = route.params;
    const [reviews, setReviews] = useState([]);
    const [originalReviews, setOriginalReviews] = useState([]);
    const [netabare, setNetabare] = useState(false);
    const [liked, setLiked] = useState(null)
    const { user } = useContext(UserContext);
    const countries = ["古い順", "新しい順", "評価が高い順", "評価が低い順"]
    const [selectedSort, setSelectedSort] = useState(countries[1])

    const moveToCreateReviewScreen = () => {
        navigation.navigate('CreateReviewScreen', { movie })
    }

    const toggleSwitch = () => {
        setNetabare(previousState => !previousState);
    }

    const handleSortChange = (selectedItem) => {
        setSelectedSort(selectedItem)
    }

    const onClickStar = async () => {
        try {
            const userRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userRef);
            const currentLikes = userDoc.data().likes || [];

            if (userDoc.exists() && userDoc.data().likes.includes(movie.id)) {
                const updatedLikes = currentLikes.filter(movieId => movieId !== movie.id);

                await updateDoc(userRef, { likes: updatedLikes });
                setLiked(updatedLikes);
            } else {
                const updatedLikes = [...currentLikes, movie.id];

                await updateDoc(userRef, { likes: updatedLikes });
                setLiked(updatedLikes);
            }
        } catch (e) {
            console.log(e)
        }
    }

    const sortReviews = useCallback(() => {
        return [...originalReviews].sort((a, b) => {
            switch (selectedSort) {
                case "古い順":
                    return a.Create_at.seconds - b.Create_at.seconds;
                case "新しい順":
                    return b.Create_at.seconds - a.Create_at.seconds;
                case "評価が高い順":
                    return b.Star - a.Star || b.Create_at.seconds - a.Create_at.seconds;
                case "評価が低い順":
                    return a.Star - b.Star || b.Create_at.seconds - a.Create_at.seconds;
            }
        });
    }, [originalReviews, selectedSort]);

    useEffect(() => {
        const sortedReviews = sortReviews();
        const filteredReviews = sortedReviews.filter(v => !netabare ? !v.Netabare : v.Netabare);
        setReviews(filteredReviews);

    }, [netabare, selectedSort, sortReviews]);

    useEffect(() => {
        const fetchIsLiked = async () => {
            try {
                const userRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userRef);

                if (userDoc.exists()) {
                    const userLikes = userDoc.data().likes || [];
                    setLiked(userLikes.includes(movie.id));
                } else {
                    console.log('User not found');
                }
            } catch (error) {
                console.error("Error fetching likes:", error);
            }
        }
        fetchIsLiked()
    }, [liked])

    useEffect(() => {
        navigation.setOptions({
            title: movie.title
        })
    }, [movie])

    useEffect(() => {
        const getReviewsById = async () => {
            try {
                const reviewsRef = collection(db, 'reviews');
                const q = query(reviewsRef, where('MovieId', '==', movie.id), orderBy('Create_at', 'desc'));

                const unsubscribe = onSnapshot(q, async (querySnapshot) => {
                    const reviewsData = await Promise.all(querySnapshot.docs.map(async (document) => {
                        const review = document.data();
                        const reviewId = document.id;

                        const userDoc = await getDoc(doc(db, 'users', review.UserId));
                        if (userDoc.exists()) {
                            const userInfo = userDoc.data();
                            return { ...review, userInfo, id: reviewId };
                        } else {
                            console.log('User not found');
                            return review;
                        }
                    }));

                    setOriginalReviews(reviewsData);
                    setNetabare(false)
                    setReviews(reviewsData.filter(v => !v.Netabare));
                });

                return () => unsubscribe();
            } catch (error) {
                console.error('Error getting reviews:', error);
            }
        }
        getReviewsById();
    }, [movie]);
    return (
        <>
            <ScrollView style={style.container}>
                <Poster posterPath={movie.poster_path} imageWidth={780} imageHeight={480}></Poster>
                <View>
                    <View>
                        <Text style={style.title}>
                            {movie.title}
                            <TouchableOpacity onPress={onClickStar}>
                                <FontAwesome
                                    style={style.star}
                                    name={liked ? "star" : "star-o"}
                                />
                            </TouchableOpacity>
                        </Text>
                    </View>
                    <Text style={style.movieReleaseDate}>{movie.release_date}</Text>
                    <Text style={style.overview}>{movie.overview}</Text>
                </View>
                {originalReviews.some(v => v.Netabare || !v.Netabare) ?
                    <View style={style.netabare}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ color: 'white', fontSize: 20 }}>ネタバレ</Text>
                            <Switch
                                trackColor={{ false: '#767577', true: '#81b0ff' }}
                                thumbColor={netabare ? '#f5dd4b' : '#f4f3f4'}
                                ios_backgroundColor="#3e3e3e"
                                onValueChange={toggleSwitch}
                                value={netabare}
                                style={style.switch}
                            />
                        </View>
                        <SelectDropdown
                            data={countries}
                            onSelect={(selectedItem) => {
                                handleSortChange(selectedItem)
                            }}
                            buttonTextAfterSelection={(selectedItem) => {
                                return selectedItem
                            }}
                            defaultValue={selectedSort}
                        />
                    </View> : <Text style={style.noReview}>レビューがありません</Text>
                }

                {reviews.map((review, index) => (
                    <ReviewItem key={review.Create_at} review={review} navigation={navigation}/>
                ))}
            </ScrollView>
            <View style={style.container2}>
                <TouchableOpacity style={style.button} onPress={() => moveToCreateReviewScreen()}>
                    <AntDesign name="pluscircleo" size={24} color="white" />
                </TouchableOpacity>
            </View>
        </>
    );
}

const style = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#202328'
    },
    textBox: {
        paddingHorizontal: 30,
        paddingVertical: 5
    },
    title: {
        color: '#fff',
        fontSize: 26,
        fontWeight: 'bold',
        padding: 10
    },
    movieReleaseDate: {
        color: '#ccc',
        marginBottom: 10,
        paddingLeft: 10
    },
    overview: {
        color: '#fff',
        fontSize: 18,
        padding: 10,
        textAlign: 'justify'
    },
    container2: {
        position: 'absolute',
        right: 16,
        bottom: 10,
    },
    button: {
        backgroundColor: 'blue',
        borderRadius: 30,
        width: 60,
        height: 60,
        justifyContent: 'center',
        alignItems: 'center',
        opacity: 0.4,
    },
    netabare: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-evenly',
        marginBottom: 20
    },
    noReview: {
        color: 'white',
        fontSize: 20,
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
    },
    star: {
        marginLeft: 8,
        marginTop: 10,
        fontSize: 24,
        color: "yellow",

    },
    scoreText: {
        fontSize: 14,
        color: "#000",
        fontWeight: "bold",
    },
});

