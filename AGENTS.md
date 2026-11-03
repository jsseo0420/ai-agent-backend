# Todo 앱

## 개요
할 일을 추가·완료·조회하는 Todo 앱. 사용자는 로그인해 자기 할 일만 다룬다.

## 명령
- 목록: npm run todo list
- 추가: npm run todo add "<내용>"
- 완료: npm run todo done <번호>
- 오늘 완료 요약: npm run todo summary
- 옵션(--due, --tags 등)을 붙일 때는 `--`를 넣는다: npm run todo -- add "<내용>" --due YYYY-MM-DD

## 규칙
- 데이터는 Supabase에 저장한다 (예전 로컬 버전은 todo.db). UI 문구는 존댓말로.
- 인증 정보는 환경 변수에서 읽을것.

## 하지 말 것
- 실데이터(Supabase의 todos 등, todo.db)를 직접 지우거나 덮어쓰지 말 것.
