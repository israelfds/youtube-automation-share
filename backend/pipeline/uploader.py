from typing import Optional


def build_service(client_id: str, client_secret: str, refresh_token: str):
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build

    creds = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=client_id,
        client_secret=client_secret,
        scopes=["https://www.googleapis.com/auth/youtube.upload"],
    )
    return build("youtube", "v3", credentials=creds, cache_discovery=False)


def upload_video(
    video_path: str,
    title: str,
    description: str,
    tags: list[str],
    client_id: str,
    client_secret: str,
    refresh_token: str,
    is_short: bool = True,
    privacy: str = "public",
) -> str:
    """Upload video to YouTube. Returns video ID."""
    from googleapiclient.http import MediaFileUpload

    youtube = build_service(client_id, client_secret, refresh_token)

    if is_short and "#shorts" not in title.lower():
        title = f"{title} #Shorts"

    body = {
        "snippet": {
            "title": title[:100],
            "description": description,
            "tags": tags,
            "categoryId": "22",  # People & Blogs
        },
        "status": {
            "privacyStatus": privacy,
            "selfDeclaredMadeForKids": False,
        },
    }

    media = MediaFileUpload(
        video_path,
        mimetype="video/mp4",
        resumable=True,
        chunksize=10 * 1024 * 1024,  # 10 MB
    )

    request = youtube.videos().insert(part="snippet,status", body=body, media_body=media)
    response = None
    while response is None:
        _, response = request.next_chunk()

    video_id = response["id"]
    print(f"[UPLOADER] Uploaded: https://youtu.be/{video_id}")
    return video_id


def test_credentials(client_id: str, client_secret: str, refresh_token: str) -> bool:
    try:
        svc = build_service(client_id, client_secret, refresh_token)
        svc.channels().list(part="id", mine=True).execute()
        return True
    except Exception as e:
        print(f"[UPLOADER] Credential test failed: {e}")
        return False
