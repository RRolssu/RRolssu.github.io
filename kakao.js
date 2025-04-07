const REST_API_KEY = '4d713aeda8eae6d2d64dac7dd7445e62';
const REDIRECT_URI = 'http://localhost:3000';

const KAKAO_AUTH_URL = `https://kauth.kakao.com/oauth/authorize?client_id=${REST_API_KEY}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=talk_message,friends,profile_nickname&prompt=select_account`;

// SDK 초기화
Kakao.init(REST_API_KEY);

// 외부 API에서 데이터를 가져오는 함수
async function fetchExternalData() {
    try {
        // OpenWeather API 호출
        const response = await fetch('https://api.openweathermap.org/data/2.5/weather?q=Seoul&appid=5175a9e6ea9ae64865e42ba6cf3c1d01&units=metric&lang=kr');
        const data = await response.json();
        
        if (!data.main || !data.weather || !data.weather[0]) {
            throw new Error('날씨 데이터를 가져올 수 없습니다.');
        }

        const weather = data.weather[0];
        const main = data.main;

        // 날씨 설명을 한글로 변환
        const weatherDescriptions = {
            'clear sky': '맑음',
            'few clouds': '구름 조금',
            'scattered clouds': '구름 낀',
            'broken clouds': '구름 많음',
            'shower rain': '소나기',
            'rain': '비',
            'thunderstorm': '뇌우',
            'snow': '눈',
            'mist': '안개'
        };

        const koreanDescription = weatherDescriptions[weather.description] || weather.description;

        return {
            title: `서울의 현재 날씨`,
            description: `현재 온도: ${main.temp}°C\n체감 온도: ${main.feels_like}°C\n습도: ${main.humidity}%\n${koreanDescription}`,
            url: 'https://openweathermap.org/city/1835848',
            imageUrl: `https://openweathermap.org/img/wn/${weather.icon}@2x.png`
        };
    } catch (error) {
        console.error('외부 데이터 가져오기 실패:', error);
        // 오류 발생 시 기본 데이터 반환
        return {
            title: "서울의 현재 날씨",
            description: "날씨 정보를 가져오는 중입니다...",
            url: "https://openweathermap.org/city/1835848",
            imageUrl: "https://openweathermap.org/img/wn/01d@2x.png"
        };
    }
}

// 친구 목록 조회
const getFriends = async (accessToken) => {
    try {
        const response = await fetch('https://kapi.kakao.com/v1/api/talk/friends', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
            },
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('친구 목록 상세:', {
            totalCount: data.total_count,
            friends: data.elements.map(friend => ({
                uuid: friend.uuid,
                profile_nickname: friend.profile_nickname,
                profile_thumbnail_image: friend.profile_thumbnail_image
            }))
        });
        return data;
    } catch (error) {
        console.error('친구 목록 조회 중 오류 발생:', error);
        throw error;
    }
};

// 메시지 전송
async function sendMessage(accessToken, templateObject) {
    try {
        const response = await fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
            },
            body: `template_object=${encodeURIComponent(JSON.stringify(templateObject))}`
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('카카오 API 응답:', errorData);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('메시지 전송 성공:', result);
        return result;
    } catch (error) {
        console.error('메시지 전송 중 오류 발생:', error);
        throw error;
    }
}

// 외부 데이터를 가져와 메시지를 생성하고 전송하는 함수
const sendDataToFriends = async (accessToken) => {
    try {
        // 1. 외부 데이터 가져오기
        const newsData = await fetchExternalData();
        
        // 2. 메시지 템플릿 생성
        const templateObject = {
            object_type: 'feed',
            content: {
                title: newsData.title,
                description: newsData.description,
                image_url: newsData.imageUrl,
                link: {
                    web_url: `https://rrolssu.github.io/news_detail.html?title=${encodeURIComponent(newsData.title)}&description=${encodeURIComponent(newsData.description.replace(/\n/g, '%0A'))}&url=${encodeURIComponent(newsData.url)}&imageUrl=${encodeURIComponent(newsData.imageUrl)}`,
                    mobile_web_url: `https://rrolssu.github.io/news_detail.html?title=${encodeURIComponent(newsData.title)}&description=${encodeURIComponent(newsData.description.replace(/\n/g, '%0A'))}&url=${encodeURIComponent(newsData.url)}&imageUrl=${encodeURIComponent(newsData.imageUrl)}`
                }
            },
            buttons: [
                {
                    title: '자세히 보기',
                    link: {
                        web_url: `https://rrolssu.github.io/news_detail.html?title=${encodeURIComponent(newsData.title)}&description=${encodeURIComponent(newsData.description.replace(/\n/g, '%0A'))}&url=${encodeURIComponent(newsData.url)}&imageUrl=${encodeURIComponent(newsData.imageUrl)}`,
                        mobile_web_url: `https://rrolssu.github.io/news_detail.html?title=${encodeURIComponent(newsData.title)}&description=${encodeURIComponent(newsData.description.replace(/\n/g, '%0A'))}&url=${encodeURIComponent(newsData.url)}&imageUrl=${encodeURIComponent(newsData.imageUrl)}`
                    }
                }
            ]
        };
        
        // 3. 자신에게만 메시지 전송
        const result = await sendMessage(accessToken, templateObject);
        console.log('자신에게 메시지 전송 결과:', result);
        alert('나에게 뉴스가 전송되었습니다!');
        
        /* 친구들에게 보내는 코드 (주석 처리)
        // 4. 친구 목록 가져오기
        const friends = await getFriends(accessToken);
        
        // 5. 친구 UUID 배열 생성
        const receiverUuids = friends.elements.map(friend => friend.uuid);
        
        // 6. 메시지 전송
        if (receiverUuids.length > 0) {
            const result = await sendMessage(accessToken, templateObject);
            console.log('메시지 전송 결과:', result);
            alert(`${friends.total_count}명의 친구와 나에게 뉴스가 전송되었습니다!`);
        } else {
            alert('전송할 친구가 없습니다.');
        }
        */
    } catch (error) {
        console.error('데이터 전송 중 오류 발생:', error);
        alert('데이터 전송에 실패했습니다.');
    }
};

const getToken = async (code) => {
    try {
        const response = await fetch('https://kauth.kakao.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: REST_API_KEY,
                redirect_uri: REDIRECT_URI,
                code: code || 'y3jRDfIJJ8SPY2i3DBImvNRrbBAkvzXDshHqzfMHCfI5ARjNZun-iwAAAAQKFwFQAAABlg9DJqpONYg--5I0Sw', // 수동으로 입력한 코드
            }),
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('토큰 발급 성공:', data);
        
        // 토큰 발급 후 데이터 전송
        if (data.access_token) {
            await sendDataToFriends(data.access_token);
        }
        
        return data;
    } catch (error) {
        console.error('토큰 발급 중 오류 발생:', error);
        throw error;
    }
};

// 수동으로 토큰 발급을 테스트하는 함수
const testToken = () => {
    getToken('y3jRDfIJJ8SPY2i3DBImvNRrbBAkvzXDshHqzfMHCfI5ARjNZun-iwAAAAQKFwFQAAABlg9DJqpONYg--5I0Sw')
        .then(tokenData => {
            console.log('토큰 발급 성공:', tokenData);
            localStorage.setItem('kakao_token', tokenData.access_token);
            alert('토큰이 발급되었습니다!');
        })
        .catch(error => {
            console.error('토큰 발급 실패:', error);
            alert('토큰 발급에 실패했습니다.');
        });
};

// 로그인 버튼 클릭 시 실행될 함수
const handleKakaoLogin = () => {
    window.location.href = KAKAO_AUTH_URL;
};

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    
    if (error) {
        console.error('카카오 로그인 오류:', error);
        alert('로그인 중 오류가 발생했습니다.');
        return;
    }
    
    if (code) {
        console.log('인증 코드:', code);
        getToken(code)
            .then(tokenData => {
                console.log('토큰 발급 성공:', tokenData);
                localStorage.setItem('kakao_token', tokenData.access_token);
                alert('토큰이 발급되었습니다!');
            })
            .catch(error => {
                console.error('토큰 발급 실패:', error);
                alert('토큰 발급에 실패했습니다.');
            });
    }
});

// 안전한 디코딩 함수 추가
function safeDecodeURIComponent(str) {
    try {
        return decodeURIComponent(str);
    } catch (e) {
        return str;
    }
}

// URL 파라미터 처리 부분
document.addEventListener('DOMContentLoaded', function() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        
        // 각 파라미터를 안전하게 디코딩
        const title = urlParams.get('title') ? safeDecodeURIComponent(urlParams.get('title')) : '';
        const description = urlParams.get('description') ? safeDecodeURIComponent(urlParams.get('description')) : '';
        const url = urlParams.get('url') ? safeDecodeURIComponent(urlParams.get('url')) : '';
        const imageUrl = urlParams.get('imageUrl') ? safeDecodeURIComponent(urlParams.get('imageUrl')) : '';

        // HTML 요소 업데이트
        document.getElementById('weatherTitle').textContent = title;
        document.getElementById('weatherDescription').textContent = description;
        document.getElementById('weatherImage').src = imageUrl;
        document.getElementById('originalLink').href = url;
    } catch (error) {
        console.error('Error processing URL parameters:', error);
        document.getElementById('weatherTitle').textContent = '날씨 정보를 표시할 수 없습니다';
        document.getElementById('weatherDescription').textContent = '죄송합니다. 날씨 정보를 불러오는 중 오류가 발생했습니다.';
    }
});
