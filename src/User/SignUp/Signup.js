import React, { useState } from "react";
import "../Login/Login.css";
import { useNavigate } from "react-router-dom";
import { signUp } from "../../services/supabaseApi";

const getFriendlyErrorMessage = (message) => {
  if (message.includes('unique constraint') || message.includes('already registered')) {
    return '이미 사용 중인 이메일입니다.';
  }
  if (message.includes('should be at least 6 characters')) {
    return '비밀번호는 6자 이상이어야 합니다.';
  }
  return '회원가입 중 오류가 발생했습니다. 다시 시도해주세요.';
}

export default function Signup() {
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPw) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await signUp({ email, password, nickname });
      alert("회원가입 성공! 이메일로 발송된 인증 링크를 클릭하여 가입을 완료해주세요.");
      navigate("/login");
    } catch (err) {
      setError(getFriendlyErrorMessage(err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2 className="login-title">회원가입</h2>
        <p className="login-subtitle">하루온에 오신 것을 환영합니다!</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="nickname">닉네임</label>
            <input
              id="nickname"
              name="nickname"
              type="text"
              placeholder="닉네임을 입력하세요"
              required
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label htmlFor="email">이메일 (로그인 아이디)</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="이메일을 입력하세요"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label htmlFor="password">비밀번호</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="비밀번호를 입력하세요"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label htmlFor="confirmPw">비밀번호 확인</label>
            <input
              id="confirmPw"
              name="confirmPw"
              type="password"
              placeholder="비밀번호를 다시 입력하세요"
              required
              autoComplete="new-password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
            />
          </div>

          {error && <p style={{ color: "red", fontSize: "14px" }}>{error}</p>}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? '가입 중...' : '회원가입 완료'}
          </button>
        </form>
      </div>
    </div>
  );
}