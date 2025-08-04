// const axios = require("axios");
import axios from "axios";
const url = "https://jsonplaceholder.typicode.com/todos/1"

interface Todo {
    userId: number;
    title: string;
    completed: boolean;
}

axios.get(url).then(res=>{
    const todo = res.data as Todo;
    const userId = todo.userId;
    const tiile = todo.title;
    const completed = todo.completed;
    console.log(`to do your slut wife ${userId}, ${tiile}, ${completed}`);
    const yourWifeBJPrice = constructYourWife(userId, tiile, completed);
    console.log(yourWifeBJPrice);
})

const constructYourWife = (id: number, title: string, completed: boolean) => {
    const yourWifePussy = `Has an id of ${id}, a title of ${title} and boobies of ${completed}`
    return yourWifePussy;
}