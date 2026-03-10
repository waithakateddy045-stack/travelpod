import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import CreatePostChoice from '../../components/post/creation/CreatePostChoice';
import VideoPostWizard from '../../components/post/creation/VideoPostWizard';
import PhotoPostWizard from '../../components/post/creation/PhotoPostWizard';
import TextPostComposer from '../../components/post/creation/TextPostComposer';
import './UploadPage.css';

export default function UploadPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [selectedType, setSelectedType] = useState(null);

    // If navigated with a type preset (e.g. from a direct link or specific action)
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const type = params.get('type');
        if (type && ['VIDEO', 'PHOTO', 'TEXT'].includes(type.toUpperCase())) {
            setSelectedType(type.toUpperCase());
        }
    }, [location]);

    const handleComplete = (post) => {
        // Navigate to the newly created post or feed
        navigate(`/post/${post.id}`);
    };

    const handleCancel = () => {
        if (selectedType) {
            setSelectedType(null);
        } else {
            navigate(-1);
        }
    };

    return (
        <div className="upload-page-refined">
            {!selectedType && (
                <CreatePostChoice
                    onSelect={setSelectedType}
                    onClose={() => navigate(-1)}
                />
            )}

            {selectedType === 'VIDEO' && (
                <VideoPostWizard
                    onComplete={handleComplete}
                    onCancel={handleCancel}
                />
            )}

            {selectedType === 'PHOTO' && (
                <PhotoPostWizard
                    onComplete={handleComplete}
                    onCancel={handleCancel}
                />
            )}

            {selectedType === 'TEXT' && (
                <TextPostComposer
                    onComplete={handleComplete}
                    onCancel={handleCancel}
                />
            )}
        </div>
    );
}
